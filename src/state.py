# Shared state for ESP32 node URLs
connected_devices = {}

sensor_node_url = None
sensor_last_seen = None

camera_node_url = None
camera_stream_url = None
camera_capture_url = None
camera_last_seen = None

from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

