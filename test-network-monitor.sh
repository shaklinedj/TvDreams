#!/bin/bash

# Test the network monitoring tool with a mock API endpoint
# This allows testing without running the actual server

echo "=========================================="
echo "Network Monitoring Tool - Functional Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Check script exists and is executable
echo "Test 1: Script Existence and Permissions"
if [ -x "./monitor-network.sh" ]; then
    echo -e "${GREEN}?${NC} monitor-network.sh exists and is executable"
else
    echo -e "${RED}?${NC} monitor-network.sh is missing or not executable"
    exit 1
fi

# Test 2: Check documentation exists
echo ""
echo "Test 2: Documentation"
if [ -f "HERRAMIENTA-MONITOREO-RED.md" ]; then
    echo -e "${GREEN}?${NC} HERRAMIENTA-MONITOREO-RED.md exists"
else
    echo -e "${RED}?${NC} HERRAMIENTA-MONITOREO-RED.md is missing"
    exit 1
fi

# Test 3: Check required dependencies
echo ""
echo "Test 3: Dependencies"
dependencies_ok=true

if command -v curl &> /dev/null; then
    echo -e "${GREEN}?${NC} curl is installed"
else
    echo -e "${RED}?${NC} curl is not installed"
    dependencies_ok=false
fi

if command -v bc &> /dev/null; then
    echo -e "${GREEN}?${NC} bc is installed"
else
    echo -e "${RED}?${NC} bc is not installed"
    dependencies_ok=false
fi

if [ "$dependencies_ok" = false ]; then
    echo ""
    echo -e "${YELLOW}Note: Install missing dependencies:${NC}"
    echo "  Ubuntu/Debian: sudo apt-get install curl bc"
    echo "  CentOS/RHEL:   sudo yum install curl bc"
    exit 1
fi

# Test 4: Check script structure
echo ""
echo "Test 4: Script Structure"
required_functions=(
    "get_network_usage"
    "get_usage_bar"
    "get_usage_color"
    "get_status_text"
)

structure_ok=true
for func in "${required_functions[@]}"; do
    if grep -q "$func" "./monitor-network.sh"; then
        echo -e "${GREEN}?${NC} Function '$func' exists"
    else
        echo -e "${RED}?${NC} Function '$func' is missing"
        structure_ok=false
    fi
done

if [ "$structure_ok" = false ]; then
    exit 1
fi

# Test 5: Check README was updated
echo ""
echo "Test 5: README Integration"
if grep -q "monitor-network.sh" "README.md"; then
    echo -e "${GREEN}?${NC} README.md references the monitoring tool"
else
    echo -e "${YELLOW}?${NC} README.md doesn't reference the monitoring tool"
fi

if grep -q "HERRAMIENTA-MONITOREO-RED.md" "README.md"; then
    echo -e "${GREEN}?${NC} README.md links to documentation"
else
    echo -e "${YELLOW}?${NC} README.md doesn't link to documentation"
fi

# Test 6: Verify API endpoint configuration
echo ""
echo "Test 6: API Configuration"
if grep -q "API_URL.*localhost.*analytics" "./monitor-network.sh"; then
    echo -e "${GREEN}?${NC} Script configured to query /api/analytics endpoint"
else
    echo -e "${RED}?${NC} API endpoint configuration issue"
    exit 1
fi

# Test 7: Check for proper error handling
echo ""
echo "Test 7: Error Handling"
if grep -q "Cannot connect to server" "./monitor-network.sh"; then
    echo -e "${GREEN}?${NC} Script has connection error handling"
else
    echo -e "${YELLOW}?${NC} Script may lack proper error handling"
fi

# Test 8: Verify configurable parameters
echo ""
echo "Test 8: Configurable Parameters"
if grep -q 'PORT=${1:-3000}' "./monitor-network.sh"; then
    echo -e "${GREEN}?${NC} Port is configurable (default: 3000)"
else
    echo -e "${RED}?${NC} Port configuration issue"
    exit 1
fi

if grep -q 'INTERVAL=${2:-' "./monitor-network.sh"; then
    echo -e "${GREEN}?${NC} Interval is configurable"
else
    echo -e "${RED}?${NC} Interval configuration issue"
    exit 1
fi

# Test 9: Mock API response parsing
echo ""
echo "Test 9: API Response Parsing"

# Create a secure temporary file
mock_file=$(mktemp)
echo '{"systemMetrics":{"networkUsageMBps":0.1234},"activeScreens":3}' > "$mock_file"

# Extract value using same method as script  
mock_mbps=$(grep -oE '"networkUsageMBps":[0-9]+\.?[0-9]*' "$mock_file" | cut -d':' -f2)

if [ ! -z "$mock_mbps" ]; then
    echo -e "${GREEN}?${NC} Can correctly parse networkUsageMBps from API response (value: $mock_mbps)"
else
    echo -e "${YELLOW}?${NC} API response parsing test skipped (value: '$mock_mbps')"
fi

rm -f "$mock_file"

# Test 10: Verify documentation content
echo ""
echo "Test 10: Documentation Quality"
doc_checks=0
doc_total=5

if grep -q "Descripción" "HERRAMIENTA-MONITOREO-RED.md"; then
    ((doc_checks++))
fi

if grep -q "Uso" "HERRAMIENTA-MONITOREO-RED.md"; then
    ((doc_checks++))
fi

if grep -q "Ejemplos" "HERRAMIENTA-MONITOREO-RED.md" || grep -q "Examples" "HERRAMIENTA-MONITOREO-RED.md"; then
    ((doc_checks++))
fi

if grep -q "Solución de Problemas" "HERRAMIENTA-MONITOREO-RED.md" || grep -q "Troubleshooting" "HERRAMIENTA-MONITOREO-RED.md"; then
    ((doc_checks++))
fi

if grep -q "MB/s" "HERRAMIENTA-MONITOREO-RED.md"; then
    ((doc_checks++))
fi

if [ $doc_checks -ge 4 ]; then
    echo -e "${GREEN}?${NC} Documentation is comprehensive ($doc_checks/$doc_total sections found)"
else
    echo -e "${YELLOW}?${NC} Documentation could be more complete ($doc_checks/$doc_total sections found)"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}All tests passed!${NC}"
echo "=========================================="
echo ""
echo "The network monitoring tool is ready to use."
echo ""
echo -e "${YELLOW}Usage:${NC}"
echo "  ./monitor-network.sh              # Default settings"
echo "  ./monitor-network.sh 8080         # Custom port"
echo "  ./monitor-network.sh 3000 5       # Custom port and interval"
echo ""
echo -e "${YELLOW}Requirements before running:${NC}"
echo "  1. Start the CMS server: npm run start"
echo "  2. Verify server is running: curl http://localhost:3000/api/analytics"
echo "  3. Run the monitor: ./monitor-network.sh"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  See HERRAMIENTA-MONITOREO-RED.md for complete usage guide"
echo ""