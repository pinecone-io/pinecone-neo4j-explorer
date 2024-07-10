import pandas as pd
import logging
import email
import os
from dotenv import load_dotenv
from neo4j import GraphDatabase
import textwrap
from pinecone import Pinecone
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv


# Read the first 10 rows of "emails.csv"
emails_df = pd.read_csv("emails.csv", skiprows=range(1, 10), nrows=40000)
print(emails_df.count())

# print(find_dotenv())
# Load environment variables from .env file
load_dotenv(find_dotenv())


# Read Neo4j credentials from environment variables
neo4j_username = os.getenv('NEO4J_USERNAME')
neo4j_password = os.getenv('NEO4J_PASSWORD')
neo4j_uri = os.getenv('NEO4J_URI')

# print(neo4j_password)

# Create a Neo4j driver instance
driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))

# Verify the connection
def verify_connection(driver):
    try:
        with driver.session() as session:
            result = session.run("RETURN 1")
            if result.single()[0] == 1:
                print("Connection to Neo4j established successfully.")
            else:
                print("Failed to establish connection to Neo4j.")
    except Exception as e:
        print(f"An error occurred: {e}")

# verify_connection(driver)





# Load Pinecone API key from environment variables
pinecone_api_key = os.getenv('PINECONE_API_KEY')
print(pinecone_api_key)

# Initialize Pinecone client
pc = Pinecone(api_key=pinecone_api_key)

# Create a Pinecone index
index_name = "enron"
pindex = pc.Index(index_name)

def save_transaction_graph(sender, recipient, subject, body, sent_date, transaction_id):
    if not sender or not recipient:
        print("Error: Sender or recipient address is null.")
        return

    with driver.session() as session:
        session.run(
            """
            MERGE (from:EmailAddress {address: $sender})
            MERGE (to:EmailAddress {address: $recipient})
            MERGE (email:Email {id: $transaction_id, body: $body, subject: $subject, sent_date: $sent_date})
            CREATE (from)-[:EMAIL_FROM]->(email)
            CREATE (email)-[:EMAIL_TO]->(to)
            """,
            sender=sender,
            recipient=recipient,
            subject=subject,
            body=body,
            sent_date=sent_date,
            transaction_id=transaction_id
        )

def recursive_text_splitter(document, max_chunk_size):
    # Use textwrap to initially split the text into lines of max_chunk_size
    chunks = textwrap.wrap(document, width=max_chunk_size)
    
    final_chunks = []
    
    for chunk in chunks:
        if len(chunk) > max_chunk_size:
            # If a chunk is still larger than max_chunk_size, split it further
            final_chunks.extend(recursive_text_splitter(chunk, max_chunk_size))
        else:
            final_chunks.append(chunk)
    
    return final_chunks


client = OpenAI()

def get_embedding(text):
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

def save_transaction_embedding(email_from, email_to, email_subject, email_body, email_sent_date, transaction_id):
  chunks = recursive_text_splitter(email_body, 512)
  
  # Create an index if it doesn't exist  
  for chunk in chunks:
      chunk_id = transaction_id + "_" + str(chunks.index(chunk))
      embedding = get_embedding(chunk)
      metadata = {
          "email_from": email_from,
          "email_to": email_to,
          "email_subject": email_subject,
          "email_sent_date": email_sent_date,
          "transaction_id": transaction_id,
          "chunk": chunk
      }
      
      for key, value in metadata.items():
            if value is None:
                metadata[key] = "null" 

      pindex.upsert([(chunk_id, embedding, metadata)])
  

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

batch_size = 1000
batch_count = 0

for index, row in emails_df.iterrows():
    try:
        msg = email.message_from_string(row['message'])
        email_from = msg['From']
        email_to = msg['To']
        email_subject = msg['Subject']
        email_body = msg.get_payload()
        email_sent_date = msg['Date']
        
        logging.info(f"Processing email {index + 1}")
        
        import hashlib

        hash_input = f"{email_from}{email_to}{email_subject}{email_sent_date}"
        transaction_id = hashlib.sha256(hash_input.encode()).hexdigest()

        save_transaction_graph(email_from, email_to, email_subject, email_body, email_sent_date, transaction_id)
        save_transaction_embedding(email_from, email_to, email_subject, email_body, email_sent_date, transaction_id)
        
        # Batch processing
        if (index + 1) % batch_size == 0:
            batch_count += 1
            logging.info(f"Processed {batch_count * batch_size} emails so far.")
            
    except Exception as e:
        logging.error(f"Error processing email {index + 1}: {e}")


