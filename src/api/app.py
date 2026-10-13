"""
Flask Application Factory for Cardiovascular Risk Prediction API.
Configures CORS, registers API blueprint, and sets up error handling.
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from src.api.routes import api_bp


def create_app(test_config=None) -> Flask:
    app = Flask(__name__)

    # Default configuration
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB max payload

    if test_config:
        app.config.update(test_config)

    # Enable CORS for local and web frontend origins
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=False
    )

    # Register API blueprint
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({
            "name": "Cardiovascular Risk Prediction & 3D Visualization API",
            "version": "1.0.0",
            "status": "online",
            "documentation": "/api/schema",
            "health_check": "/api/health"
        }), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({
            "status": "error",
            "error_code": "NOT_FOUND",
            "message": "The requested resource was not found."
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({
            "status": "error",
            "error_code": "METHOD_NOT_ALLOWED",
            "message": "HTTP method not allowed for this endpoint."
        }), 405

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
