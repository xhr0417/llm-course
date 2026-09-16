FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 默认用仓库自带示例文档启动；挂载课程内容：
#   docker run -v $(pwd)/../../content:/corpus -e RAG_CORPUS=/corpus -p 8000:8000 rag-service
ENV RAG_CORPUS=/app/data/sample_docs

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
