#!/usr/bin/env bash
set -e

if [ "$1" = "clean" ]; then
    echo "🧹 Đang dọn dẹp sạch sẽ thư mục outputs/..."
    docker compose run --rm --entrypoint rm studio -rf outputs
    mkdir -p outputs
    echo "✓ Đã xóa sạch outputs! Bạn có thể bắt đầu chạy lại từ đầu."
    exit 0
fi

docker compose run --rm studio -m studio "$@"

