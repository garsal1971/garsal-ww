#!/usr/bin/env bash
# run_fitsteps.sh
# Pushes a step count to the device, launches FitStepsInjector, waits for the result,
# and prints it to stdout.
#
# Usage:
#   ./run_fitsteps.sh <step_count>
#
# Example:
#   ./run_fitsteps.sh 8000
#
# Prerequisites:
#   - adb in PATH
#   - Device connected and authorized (adb devices should show your device)
#   - FitStepsInjector APK already installed on the device
#   - Google account with Fit permissions granted (first run will prompt for OAuth on-device)

set -euo pipefail

STEP_COUNT="${1:-}"
if [[ -z "$STEP_COUNT" ]]; then
    echo "Usage: $0 <step_count>" >&2
    exit 1
fi

# Validate it's a positive integer
if ! [[ "$STEP_COUNT" =~ ^[0-9]+$ ]]; then
    echo "Error: step_count must be a non-negative integer, got: '$STEP_COUNT'" >&2
    exit 1
fi

INPUT_FILE="/sdcard/steps_input.txt"
RESULT_FILE="/sdcard/steps_result.txt"
PACKAGE="com.garsal.fitinjector"
ACTIVITY=".MainActivity"
MAX_WAIT=30   # seconds to wait for result file

echo "[1/5] Writing step count ($STEP_COUNT) to device $INPUT_FILE ..."
echo -n "$STEP_COUNT" | adb shell "cat > $INPUT_FILE"

echo "[2/5] Clearing any previous result file ..."
adb shell "rm -f $RESULT_FILE" || true

echo "[3/5] Launching FitStepsInjector ..."
adb shell am start -n "${PACKAGE}/${ACTIVITY}"

echo "[4/5] Waiting up to ${MAX_WAIT}s for result ..."
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    sleep 1
    ELAPSED=$((ELAPSED + 1))
    # Check if result file exists on device
    RESULT=$(adb shell "cat $RESULT_FILE 2>/dev/null" || true)
    if [[ -n "$RESULT" ]]; then
        break
    fi
done

if [[ -z "${RESULT:-}" ]]; then
    echo "[ERROR] Timed out after ${MAX_WAIT}s waiting for $RESULT_FILE on device." >&2
    echo "        Check 'adb logcat -s FitStepsInjector' for details." >&2
    exit 1
fi

echo "[5/5] Result: $RESULT"

# Exit non-zero if the result indicates an error
if [[ "$RESULT" == ERROR:* ]]; then
    echo "Step injection FAILED." >&2
    exit 1
fi

echo "Step injection SUCCEEDED."
exit 0
