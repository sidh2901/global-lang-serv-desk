#!/bin/bash

# Health check script to verify all services are running correctly

echo "🏥 Checking Lingua Service Desk health..."

services=(
    "Frontend:http://localhost:3000"
    "Backend:http://localhost:8080/health"
    "ASR:http://localhost:8001/health"
    "Translator:http://localhost:8002/health"
    "TTS:http://localhost:8003/health"
    "LiveKit:http://localhost:7880"
)

all_healthy=true

for service in "${services[@]}"; do
    name="${service%:*}"
    url="${service#*:}"
    
    printf "%-12s " "$name:"
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Unhealthy"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    echo ""
    echo "🎉 All services are healthy!"
    exit 0
else
    echo ""
    echo "⚠️  Some services are not healthy. Check docker-compose logs for details."
    exit 1
fi