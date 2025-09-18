export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  hangup: () => void;
  setTargetLanguage: (lang: string) => void;
  setVoice: (voice: string) => void;
};

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const cb = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", cb);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", cb);
  });
}

export async function startRealtime({
  targetLanguage,
  voice,
  onPartial,
  onFinal,
  onSourceFinal,
  onError,
}: {
  targetLanguage: string;                 // e.g., "Spanish"
  voice: string;                          // e.g., "alloy"
  onPartial?: (t: string) => void;        // streaming translated text
  onFinal?: (t: string) => void;          // final translated text
  onSourceFinal?: (t: string) => void;    // final ASR of what you said
  onError?: (e: any) => void;
}): Promise<RealtimeHandle> {
  try {
    // Mic (user gesture from clicking Start)
    const local = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // Ephemeral session
    const sessionRes = await fetch("/api/realtime/session");
    if (!sessionRes.ok) throw new Error(`Session route failed: ${await sessionRes.text()}`);
    const session = await sessionRes.json();
    if (!session?.client_secret?.value) throw new Error("Missing ephemeral token");

    // PeerConnection
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });

    // Send mic track
    const mic = new MediaStream();
    local.getAudioTracks().forEach((t) => {
      mic.addTrack(t);
      pc.addTrack(t, mic);
    });

    // Remote audio sink (model TTS)
    const sink = new MediaStream();
    const audio = new Audio();
    audio.autoplay = true;
    (audio as any).playsInline = true;
    audio.srcObject = sink;
    pc.ontrack = (e) => {
      e.streams[0].getAudioTracks().forEach((t) => sink.addTrack(t));
      audio.play().catch(() => {}); // Start button = user gesture, so ok
    };

    // DataChannel FIRST (so it’s in SDP)
    const dc = pc.createDataChannel("oai-events");
    let dcOpen = false;
    let buf = "";

    const pushSessionUpdate = (update: any) =>
      dcOpen && dc.send(JSON.stringify({ type: "session.update", session: update }));

    const setTargetLanguage = (lang: string) => {
      const instr =
        `Live translator. Input is user speech (auto-detected). ` +
        `Output ONLY the translation in ${lang}. Speak it and include matching text. No extra words.`;
      pushSessionUpdate({ instructions: instr });
    };

    const setVoice = (v: string) => pushSessionUpdate({ voice: v });

    dc.onopen = () => {
      dcOpen = true;
      setVoice(voice);
      setTargetLanguage(targetLanguage);

      // Arm continuous turn-taking ONCE — request audio + text
      dc.send(JSON.stringify({
        type: "response.create",
        response: { conversation: "auto", modalities: ["audio", "text"] },
      }));
    };

    dc.onmessage = (m) => {
      let msg: any;
      try { msg = JSON.parse(m.data); } catch { return; }

      // We ignore output_audio_buffer.* chatter (audio arrives on remote track)
      switch (msg.type) {
        case "conversation.item.input_audio_transcription.completed": {
          const src = msg.transcript ?? msg.text ?? "";
          if (src) onSourceFinal?.(src);
          break;
        }
        case "response.text.delta":
        case "response.output_text.delta":
        case "response.delta": {
          buf += msg.delta ?? "";
          onPartial?.(buf);
          break;
        }
        case "response.output_text.done":
        case "response.completed":
        case "response.done": {
          if (buf.trim()) onFinal?.(buf);
          buf = "";
          // No new response.create — conversation:"auto" keeps listening.
          break;
        }
        case "error": {
          onError?.(new Error(msg.error?.message || "Realtime error"));
          break;
        }
      }
    };

    // SDP exchange
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.client_secret.value}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: pc.localDescription?.sdp ?? offer.sdp!,
    });
    if (!sdpRes.ok) throw new Error(`SDP exchange failed: ${await sdpRes.text()}`);

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    const hangup = () => {
      try { dc.close(); } catch {}
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
      local.getTracks().forEach((t) => t.stop());
    };

    return { pc, dc, hangup, setTargetLanguage, setVoice };
  } catch (e) {
    onError?.(e);
    throw e;
  }
}
