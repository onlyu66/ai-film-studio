#!/usr/bin/env bash
set -e
docker compose run --rm studio -m studio "$@"
