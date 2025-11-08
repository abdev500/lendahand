#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"

log_info() {
  echo -e "\033[1;34m[INFO]\033[0m $1"
}

log_error() {
  echo -e "\033[1;31m[ERROR]\033[0m $1"
}

log_info "Starting frontend..."

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  log_error "Node.js (node) is required but not found in PATH."
  exit 1
fi

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  log_error "npm is required but not found in PATH."
  exit 1
fi

log_info "Installing dependencies..."
cd "$PROJECT_ROOT"
"$NPM_BIN" install

log_info "Starting Vite development server..."
"$NPM_BIN" run dev -- --clearScreen false
