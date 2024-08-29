# Pinecone - Neo4j integration demo

### Supreme Court Case Analysis 

This project consists of several components for processing, analyzing, and exploring Supreme Court cases. The main components are:

1. MongoDB Database
2. Neo4j Account
3. Pinecone Account


## Setup

1. Clone the repository
2. Install dependencies:
   - In the root directory, install Python dependencies using Poetry:
     ```
     poetry install
     ```
   - In the `explorer` directory, install Node.js dependencies:
     ```
     cd explorer
     pnpm install
     ```
3. Set up environment variables in a `.env` file:
   - NEO4J_URI
   - NEO4J_USERNAME
   - NEO4J_PASSWORD
   - MONGODB_USERNAME
   - MONGODB_PASSWORD
   - MONGODB_HOST
   - MONGODB_DATABASE
   - PINECONE_API_KEY
   - OPENAI_API_KEY

## Data Processing

The data processing scripts are located in Jupyter notebooks:

1. `process_raw.ipynb`: Fetches and processes raw case data
2. `process_scotus.ipynb`: Processes SCOTUS cases and generates embeddings


## Running the Application 
Once you complete processing the data, you can start the application by running the following in the `explorer` directory:

```
pnpm dev
```

