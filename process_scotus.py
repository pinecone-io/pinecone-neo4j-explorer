from tinydb import TinyDB, where
import os
from dotenv import load_dotenv
from neo4j import GraphDatabase
import textwrap
from openai import OpenAI
import os
from pinecone import Pinecone
import re
from datetime import datetime
from flair.data import Sentence
from flair.nn import Classifier
import hashlib
from tqdm import tqdm
import random
load_dotenv()
###########################
# Databases               #
###########################
# Load Pinecone API key from environment variables
pinecone_api_key = os.getenv('PINECONE_API_KEY')
print(pinecone_api_key)

# Initialize Pinecone client
pc = Pinecone(api_key=pinecone_api_key)

# Create a Pinecone index
index_name = "scotus"
pindex = pc.Index(index_name)

# Load the NER and relation classifiers
tagger = Classifier.load('ner')
extractor = Classifier.load('relations')

client = OpenAI()

# Read Neo4j credentials from environment variables
neo4j_username = os.getenv('NEO4J_USERNAME')
neo4j_password = os.getenv('NEO4J_PASSWORD')
neo4j_uri = os.getenv('NEO4J_URI')

# Create a Neo4j driver instance
driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))

opinions_db = TinyDB('opinions.db.json')
cases_db = TinyDB('cases.db.json')

###########################
# Classes                 #
###########################

class Node:
    def __init__(self, id, label, properties):
        self.id = escape_neo4j_string(id)
        self.label = escape_neo4j_string(label)
        self.properties = {k: escape_neo4j_string(v) if isinstance(v, str) else v for k, v in properties.items()}

    def create_node_query(self):
        props = ', '.join([f"{key}: ${key}" for key in self.properties.keys()])
        return f"MERGE (n:{self.label} {{id: '{self.id}', {props}}})"

    def create_node(self):
        if not self.id or not self.label or any(value is None for value in self.properties.values()):
            # print("Node creation skipped due to null values in id, label, or properties.")
            return
        query = self.create_node_query()
        with driver.session() as session:
            session.run(query, **self.properties)

class Edge:
    def __init__(self, from_node_id, to_node_id, relationship_type, properties, increment_property):
        self.from_node_id = escape_neo4j_string(from_node_id)
        self.to_node_id = escape_neo4j_string(to_node_id)
        self.relationship_type = escape_neo4j_string(relationship_type)
        self.properties = {k: escape_neo4j_string(v) if isinstance(v, str) else v for k, v in properties.items()}
        self.increment_property = increment_property

    def create_edge_query(self):
        props = ', '.join([f"{key}: ${key}" for key in self.properties.keys()])
        return (f"MATCH (a {{id: '{self.from_node_id}'}}), (b {{id: '{self.to_node_id}'}}) "
                f"MERGE (a)-[r:{self.relationship_type} {{{props}}}]->(b) "
                f"ON CREATE SET r.{self.increment_property} = 1 "
                f"ON MATCH SET r.{self.increment_property} = r.{self.increment_property} + 1")

    def create_edge(self):
        if any(value is None for value in self.properties.values()):
            # Skip edge creation if any property value is None
            return
        query = self.create_edge_query()
        with driver.session() as session:
            session.run(query, **self.properties)

class Citation:
    def __init__(self, data):
        self.volume = data.get('volume')
        self.page = data.get('page')
        self.year = data.get('year')

    def __str__(self):
        return f"{self.volume} U.S. {self.page} ({self.year})"

class Advocate:
    def __init__(self, data):
        advocate_data = data.get('advocate', {})
        self.name = advocate_data.get('name') if advocate_data else None
        self.description = data.get('advocate_description')

    def __str__(self):
        return f"{self.name}: {self.description}"

class Decision:
    def __init__(self, data):
        self.description = data.get('description')
        self.winning_party = data.get('winning_party')
        self.decision_type = data.get('decision_type')
        self.votes = [Vote(v) for v in data.get('votes', []) if v]

    def __str__(self):
        return f"{self.description} - Winner: {self.winning_party}"

class Vote:
    def __init__(self, data):
        self.member = Justice(data.get('member', {}))
        self.vote = data.get('vote')
        self.opinion_type = data.get('opinion_type')
        self.href = data.get('href')

    def __str__(self):
        return f"{self.member.name}: {self.vote}"

class Justice:
    def __init__(self, data):
        self.id = data.get('ID')
        self.name = data.get('name')
        self.roles = [Role(r) for r in data.get('roles', []) if r]

    def __str__(self):
        return self.name

class Role:
    def __init__(self, data):
        self.type = data.get('type')
        self.date_start = datetime.fromtimestamp(data.get('date_start', 0))
        self.date_end = datetime.fromtimestamp(data.get('date_end', 0))
        self.role_title = data.get('role_title')

    def __str__(self):
        return f"{self.role_title} ({self.date_start.year}-{self.date_end.year})"

class DecidedBy:
    def __init__(self, data):
        self.name = data.get('name')
        self.members = [Justice(j) for j in data.get('members', []) if j]

class WrittenOpinion:
    def __init__(self, data):
        self.id = data.get('id')
        self.title = data.get('title')
        self.author = data.get('author')
        self.type_value = data.get('type', {}).get('value')
        self.type_label = data.get('type', {}).get('label')
        self.justia_opinion_id = data.get('justia_opinion_id')
        self.justia_opinion_url = data.get('justia_opinion_url')
        self.judge_full_name = data.get('judge_full_name')
        self.judge_last_name = data.get('judge_last_name')
        self.title_overwrite = data.get('title_overwrite')
        self.href = data.get('href')

    def __str__(self):
        return f"{self.title} ({self.type_label})"

class Case:
    def __init__(self, data):
        self.id = data.get('ID')
        self.name = data.get('name')
        self.href = data.get('href')
        self.docket_number = data.get('docket_number')
        self.first_party = data.get('first_party')
        self.first_party_label = data.get('first_party_label')
        self.second_party = data.get('second_party')
        self.second_party_label = data.get('second_party_label')
        self.decided_date = datetime.fromtimestamp(data.get('timeline', [{}])[0].get('dates', [0])[0])
        self.citation = Citation(data.get('citation', {}))
        self.advocates = [Advocate(a) for a in data.get('advocates', []) if a] if data.get('advocates') else []
        self.decisions = [Decision(d) for d in data.get('decisions', []) if d] if data.get('decisions') else []
        self.decided_by = DecidedBy(data.get('decided_by', {})) if data.get('decided_by') else None
        self.term = data.get('term')
        self.justia_url = data.get('justia_url')
        self.written_opinion = [WrittenOpinion(o) for o in data.get('written_opinion', []) if o] if data.get('written_opinion') else []


    def __str__(self):
        return f"{self.name} ({self.term})"

    def print_details(self):
        print(f"Case: {self.name}")
        print(f"Href: {self.href}")
        print(f"Docket: {self.docket_number}")
        print(f"Citation: {self.citation}")
        print(f"Decided: {self.decided_date.strftime('%B %d, %Y')}")
        print(f"Parties: {self.first_party} v. {self.second_party}")
        print("\nAdvocates:")
        for advocate in self.advocates:
            print(f"  {advocate}")
        print("\nDecisions:")
        for decision in self.decisions:
            print(f"  {decision}")
            for vote in decision.votes:
                print(f"    {vote}")

class Entity:
    def __init__(self, text, label):
        self.text = text
        self.label = label

class Relation:
    def __init__(self, label, head, tail):
        self.label = label
        self.head = head
        self.tail = tail

###########################
# Functions               #
###########################

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
  
def get_embedding(text):
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding  
  
def save_opinion_embedding(case_id, opinion_text):
    chunks = recursive_text_splitter(opinion_text, 512)
    
    # Create an index if it doesn't exist  
    for chunk in chunks:
        chunk_id = str(case_id) + "_" + str(chunks.index(chunk))
        embedding = get_embedding(chunk)        
        metadata = {
            "case_id": str(case_id),
            "chunk": chunk
        }
        
        for key, value in metadata.items():
            if value is None:
                metadata[key] = "null" 

        pindex.upsert([(chunk_id, embedding, metadata)])  

def escape_neo4j_string(value):
    if isinstance(value, str):
        return re.sub(r"(['\"\\])", r"\\\1", value)
    return value

def extract_entities_and_relations(sentence_text):
    if not sentence_text:
        return [], []
    
    sentence = Sentence(sentence_text)
    
    entities = []

    tagger.predict(sentence)
    for entity in sentence.get_labels('ner'):
        entities.append(Entity(entity.data_point.text, entity.value))
    
    extractor.predict(sentence)
    
    relations = []


# Process relations (edges)
    for relation in sentence.get_labels('relation'):
        
        head_text = relation.data_point.first.text
        head_type = relation.data_point.first.get_label('ner').value
        tail_text = relation.data_point.second.text
        tail_type = relation.data_point.second.get_label('ner').value
        
        head_entity = Entity(head_text, head_type)
        tail_entity = Entity(tail_text, tail_type)
        relations.append(Relation(relation.value, head_entity, tail_entity))
            
    return entities, relations

def entity_to_node(entity: Entity):
    return Node(entity.text, entity.label, {"name": entity.text})  

def relation_to_nodes_and_edges(relation: Relation):
    head_node = entity_to_node(relation.head)
    tail_node = entity_to_node(relation.tail)      
    relation_edge = Edge(head_node.id, tail_node.id, relation.label, {}, "count")    
    return [[head_node, tail_node], relation_edge]

def calculate_hash(text):
    return hashlib.md5(text.encode()).hexdigest()

def process_scotus_opinion(writtenOpinion: WrittenOpinion, case_node: Node):
    opinion = opinions_db.get(where('id') == writtenOpinion.id)
    if not opinion or "content" not in opinion:
        return [], []
    
    save_opinion_embedding(case_node.id, opinion["content"])
    sentences = opinion['content'].split('. ')
    
    all_entities = {}
    all_relations = {}
    
    for sentence in sentences:
        entities, relations = extract_entities_and_relations(sentence)
        
        for entity in entities:
            if entity and entity.text:
                entity_hash = calculate_hash(entity.text)
                if entity_hash not in all_entities:
                    all_entities[entity_hash] = entity
        
        for relation in relations:
            if relation and relation.label:
                relation_hash = calculate_hash(relation.label)
                if relation_hash not in all_relations:
                    all_relations[relation_hash] = relation
    
    return list(all_entities.values()), list(all_relations.values())
  
def process_scotus_opinions(written_opinions: list[WrittenOpinion], case_node: Node): 
  if written_opinions:
    for opinion in written_opinions:
      if opinion:
        
        opinion_node = Node(opinion.id, "Opinion", {"title": opinion.title, "case_id": case_node.id})
        opinion_node.create_node()
        case_opinion_edge = Edge(case_node.id, opinion_node.id, "case_opinion", {}, "count")
        case_opinion_edge.create_edge()
        
        entities, relations = process_scotus_opinion(opinion, case_node)
        if entities:
          entities_nodes = [entity_to_node(entity) for entity in entities if entity]
          for relation in relations:
            if relation:
              relation_nodes, relation_edge = relation_to_nodes_and_edges(relation)
              head_node, tail_node = relation_nodes
              if head_node and tail_node:
                head_node.create_node()
                tail_node.create_node()
                relation_edge.create_edge()
                # print(f"head_node: {head_node}, tail_node: {tail_node}, relation_edge: {relation_edge}")

          for node in entities_nodes:
            if node:
              node.create_node()
              mentioned_in_edge = Edge(case_node.id, node.id, "mentioned_in", {}, "count")
              mentioned_in_edge.create_edge()

        print(".", end="")  
        
def process_scotus_case(case: Case):
  first_party = case.first_party
  second_party = case.second_party
  advocates = case.advocates if case.advocates else []
  decisions = case.decisions if case.decisions else []
  justices = case.decided_by.members if case.decided_by and case.decided_by.members else []
  
  case_node = Node(case.id, "Case", {"name": case.name, "docket_number": case.docket_number, "term": case.term, "decided_date": case.decided_date.strftime('%Y-%m-%d')})
  case_node.create_node()
  
  if first_party:
      first_party_node = Node(first_party,"Party", {"name": first_party})
      first_party_node.create_node()
      first_party_node_name = case.first_party_label      
      case_party_edge_1 = Edge(case_node.id, first_party_node.id, first_party_node_name, {}, "count")
      case_party_edge_1.create_edge()
  
  if second_party:
      second_party_node = Node(second_party, "Party", {"name": second_party})
      second_party_node.create_node()
      second_party_node_name = case.second_party_label
      case_party_edge_2 = Edge(case_node.id, second_party_node.id, second_party_node_name, {}, "count")
      case_party_edge_2.create_edge()  
  
  for advocate in advocates:
    advocate_node = Node(advocate.name, "Advocate", {"name": advocate.name, "description": advocate.description})
    advocate_node.create_node()
    advocate_edge = Edge(case_node.id, advocate_node.id, "advocated_by", {}, "count")
    advocate_edge.create_edge()
  
  for justice in justices:
    justice_node = Node(justice.id, "Justice", {"name": justice.name})
    justice_node.create_node()
    justice_edge = Edge(case_node.id, justice_node.id, "decided_by", {}, "count")
    justice_edge.create_edge()
    
  for decision in decisions:
    if decision.winning_party:
        decision_node = Node(decision.winning_party, "Party", { "name": decision.winning_party})
        decision_node.create_node()
        if decision.decision_type:  # Check if decision_type is not None
            decision_edge = Edge(case_node.id, decision_node.id, "won_by", {
                "decision_type": decision.decision_type
            }, "count")
            decision_edge.create_edge()
    for vote in decision.votes:
      justice_node = Node(vote.member.id, "Justice", {"name": vote.member.name})
      justice_node.create_node()
      vote_edge = Edge(case_node.id, justice_node.id, vote.vote, {
        "opinion_type": vote.opinion_type
      }, "count")
      vote_edge.create_edge()
  
  # print(len(case.written_opinion))  
  process_scotus_opinions(case.written_opinion, case_node)        

###########################
# Main                    #
###########################

expanded_cases = cases_db.all()
sampled_cases = random.sample(expanded_cases, 150)

for case_data in tqdm(sampled_cases):
    case = Case(case_data)
    process_scotus_case(case)