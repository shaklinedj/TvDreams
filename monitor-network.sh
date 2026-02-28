#!/bin/bash

# Real-time Network Usage Monitor for CMS H'Laure
# This script monitors network usage by querying the /api/analytics endpoint
# Usage: ./monitor-network.sh [port] [interval_seconds]

# Configuration
PORT=${1:-3001}
INTERVAL=${2:-10}
API_URL="http://localhost:${PORT}/api/analytics"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Clear screen and show header
clear
echo -e "${BOLD}${CYAN}================================${NC}"
echo -e "${BOLD}${CYAN}  Network Usage Monitor${NC}"
echo -e "${BOLD}${CYAN}  CMS H'Laure${NC}"
echo -e "${BOLD}${CYAN}================================${NC}"
echo ""
echo -e "Monitoring: ${BLUE}${API_URL}${NC}"
echo -e "Update interval: ${YELLOW}${INTERVAL}s${NC}"
echo -e "Press ${RED}Ctrl+C${NC} to exit"
echo ""

# Function to get network usage
get_network_usage() {
    # Query the API endpoint
    local response=$(curl -s "${API_URL}" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$response" ]; then
        echo "ERROR"
        return 1
    fi
    
    # Extract networkUsageMBps using grep and basic parsing
    local mbps=$(echo "$response" | grep -oE '"networkUsageMBps":[0-9]+\.?[0-9]*' | cut -d':' -f2)
    
    if [ -z "$mbps" ]; then
        echo "0.0000"
    else
        echo "$mbps"
    fi
}

# Function to format the display bar
get_usage_bar() {
    local mbps=$1
    local bar_length=50
    
    # Convert to KB/s for better visualization (0.1 MB/s = 100 KB/s)
    local kbps=$(echo "$mbps * 1024" | bc -l 2>/dev/null || echo "0")
    
    # Scale: each bar represents 10 KB/s
    local filled=$(echo "$kbps / 10" | bc 2>/dev/null || echo "0")
    
    # Cap at bar_length
    if [ "$filled" -gt "$bar_length" ]; then
        filled=$bar_length
    fi
    
    local empty=$((bar_length - filled))
    
    # Generate bar
    local bar=""
    for ((i=0; i<filled; i++)); do
        bar="${bar}¦"
    done
    for ((i=0; i<empty; i++)); do
        bar="${bar}¦"
    done
    
    echo "$bar"
}

# Function to get color based on usage
get_usage_color() {
    local mbps=$1
    
    # Convert to comparison-friendly number
    local usage_int=$(echo "$mbps * 100" | bc -l 2>/dev/null | cut -d'.' -f1)
    
    if [ "$usage_int" -lt 10 ]; then
        # < 0.1 MB/s - Green (very low)
        echo "${GREEN}"
    elif [ "$usage_int" -lt 50 ]; then
        # < 0.5 MB/s - Yellow (low)
        echo "${YELLOW}"
    elif [ "$usage_int" -lt 200 ]; then
        # < 2 MB/s - Cyan (moderate)
        echo "${CYAN}"
    else
        # >= 2 MB/s - Red (high)
        echo "${RED}"
    fi
}

# Function to get status text
get_status_text() {
    local mbps=$1
    local usage_int=$(echo "$mbps * 100" | bc -l 2>/dev/null | cut -d'.' -f1)
    
    if [ "$usage_int" -lt 1 ]; then
        echo "IDLE"
    elif [ "$usage_int" -lt 10 ]; then
        echo "VERY LOW"
    elif [ "$usage_int" -lt 50 ]; then
        echo "LOW"
    elif [ "$usage_int" -lt 100 ]; then
        echo "MODERATE"
    elif [ "$usage_int" -lt 200 ]; then
        echo "ACTIVE"
    else
        echo "HIGH"
    fi
}

# Store history for trend analysis
declare -a history
max_history=10

# Main monitoring loop
iteration=0
while true; do
    # Get current usage
    mbps=$(get_network_usage)
    
    if [ "$mbps" = "ERROR" ]; then
        echo -e "${RED}Error: Cannot connect to server at ${API_URL}${NC}"
        echo -e "${YELLOW}Make sure the server is running on port ${PORT}${NC}"
        sleep $INTERVAL
        continue
    fi
    
    # Add to history
    history+=("$mbps")
    if [ ${#history[@]} -gt $max_history ]; then
        history=("${history[@]:1}")
    fi
    
    # Calculate average if we have enough data
    if [ ${#history[@]} -ge 3 ]; then
        avg=$(echo "${history[@]}" | tr ' ' '+' | bc -l 2>/dev/null)
        avg=$(echo "scale=4; $avg / ${#history[@]}" | bc -l 2>/dev/null)
    else
        avg="$mbps"
    fi
    
    # Get display elements
    color=$(get_usage_color "$mbps")
    status=$(get_status_text "$mbps")
    bar=$(get_usage_bar "$mbps")
    
    # Convert to KB/s for additional display
    kbps=$(echo "scale=2; $mbps * 1024" | bc -l 2>/dev/null)
    
    # Display the monitoring information
    echo -e "${BOLD}Current Network Usage:${NC}"
    echo -e "  ${color}${BOLD}${mbps} MB/s${NC}  (${kbps} KB/s)  [${color}${status}${NC}]"
    echo ""
    echo -e "${BOLD}Activity:${NC}"
    echo -e "  ${color}${bar}${NC}"
    echo ""
    
    if [ ${#history[@]} -ge 3 ]; then
        echo -e "${BOLD}Average (last ${#history[@]} readings):${NC} ${avg} MB/s"
        echo ""
    fi
    
    # Show last few readings
    echo -e "${BOLD}Recent readings:${NC}"
    local count=0
    for i in "${history[@]}"; do
        local c=$(get_usage_color "$i")
        echo -e "  ${c}${i} MB/s${NC}"
        count=$((count + 1))
        if [ $count -ge 5 ]; then
            break
        fi
    done | tac  # Reverse order to show most recent first
    
    echo ""
    echo -e "${BOLD}Guide:${NC}"
    echo -e "  ${GREEN}< 0.1 MB/s${NC}  = Idle/Very Low"
    echo -e "  ${YELLOW}< 0.5 MB/s${NC}  = Low usage"
    echo -e "  ${CYAN}< 2 MB/s${NC}    = Moderate/Active"
    echo -e "  ${RED}>= 2 MB/s${NC}   = High usage"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo -e "  • ${GREEN}0.00-0.01 MB/s${NC} - No activity"
    echo -e "  • ${GREEN}0.05-0.20 MB/s${NC} - Loading images"
    echo -e "  • ${YELLOW}0.30-1.50 MB/s${NC} - Video streaming"
    echo -e "  • ${CYAN}1.00-4.00 MB/s${NC} - Multiple displays active"
    echo -e "  • ${RED}5.00+ MB/s${NC}     - High load"
    echo ""
    
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BOLD}Last update:${NC} ${timestamp}"
    echo -e "${BOLD}Reading #:${NC} $((++iteration))"
    
    # Wait for next iteration
    sleep $INTERVAL
    
    # Clear screen for next update
    clear
    echo -e "${BOLD}${CYAN}================================${NC}"
    echo -e "${BOLD}${CYAN}  Network Usage Monitor${NC}"
    echo -e "${BOLD}${CYAN}  CMS H'Laure${NC}"
    echo -e "${BOLD}${CYAN}================================${NC}"
    echo ""
    echo -e "Monitoring: ${BLUE}${API_URL}${NC}"
    echo -e "Update interval: ${YELLOW}${INTERVAL}s${NC}"
    echo -e "Press ${RED}Ctrl+C${NC} to exit"
    echo ""
done