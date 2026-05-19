# 🧠 Architecture Decisions (ADR)

This document records the major architectural decisions made during the development of AgroMind AI.

## 1. Why FastAPI over Flask/Django?
**Decision**: We chose FastAPI for the AI inference microservice.
**Reasoning**: 
FastAPI is built on Starlette and Pydantic, offering native asynchronous capabilities and automatic validation. Image inference is inherently blocking. By using FastAPI with Uvicorn workers, we can handle multiple incoming requests efficiently. Furthermore, FastAPI automatically generates OpenAPI documentation, which made integrating with the Node.js orchestrator significantly easier.

## 2. Why MobileNetV2 over ResNet/VGG?
**Decision**: We utilized transfer learning on MobileNetV2.
**Reasoning**:
While ResNet-50 might offer marginally higher theoretical accuracy, MobileNetV2 is specifically optimized for mobile and edge devices. It boasts a significantly smaller parameter footprint. By building our cloud architecture around MobileNetV2 today, we ensure seamless migration to on-device `.tflite` offline inference in the future without changing model behaviors.

## 3. Why Node.js for Orchestration?
**Decision**: We kept the application logic in Node.js instead of building a Python monolith.
**Reasoning**:
Separation of concerns. Python is unparalleled for ML inference, but Node.js (with Express and Prisma) excels at handling asynchronous I/O operations like multi-part form parsing, database pooling, and API routing. By decoupling them, we can scale the Node.js containers independently of the GPU/CPU-heavy Python containers.

## 4. Why JSON Metadata Storage in PostgreSQL?
**Decision**: We store the complex AI response inside a single `aiSummary` JSON column in PostgreSQL.
**Reasoning**:
AI models iterate quickly. Tomorrow, we might want to return `bounding_boxes` or `heatmap_urls`. If we strictly mapped every field to a SQL column, every model update would require a Prisma migration and database downtime. The JSON column gives us NoSQL-like flexibility while maintaining relational integrity for the core user and farm data.

## 5. The "Fail-Fast" Cloudinary Upload
**Decision**: Images are sent to FastAPI *before* Cloudinary.
**Reasoning**:
Initially, images were uploaded to Cloudinary, and the URL was sent to the AI. However, if the AI determined the image was a blurry mess or not a leaf, we had already paid for the Cloudinary upload and storage. By reversing the flow (forward buffer to AI -> if successful, upload to Cloudinary), we cut storage costs and optimized network bandwidth.
