export type MatchMetadata = {
  case_id: string;
  chunk: string;
};


interface Citation {
  volume?: string;
  page?: string;
  year?: string;
}

interface Advocate {
  name?: string;
  description?: string;
}

interface Vote {
  member: Justice;
  vote?: string;
  opinion_type?: string;
  href?: string;
}

interface Decision {
  description?: string;
  winning_party?: string;
  decision_type?: string;
  votes: Vote[];
}

interface Role {
  type?: string;
  date_start?: number;
  date_end?: number;
  role_title?: string;
}

interface Justice {
  ID?: string;
  name?: string;
  roles: Role[];
}

interface DecidedBy {
  name?: string;
  members: Justice[];
}

interface WrittenOpinion {
  id?: string;
  title?: string;
  author?: string;
  type?: {
    value?: string;
    label?: string;
  };
  justia_opinion_id?: string;
  justia_opinion_url?: string;
  judge_full_name?: string;
  judge_last_name?: string;
  title_overwrite?: string;
  href?: string;
}

interface Case {
  ID?: string;
  name?: string;
  href?: string;
  docket_number?: string;
  first_party?: string;
  first_party_label?: string;
  second_party?: string;
  second_party_label?: string;
  timeline?: Array<{ dates: number[] }>;
  citation: Citation;
  advocates: Advocate[];
  decisions: Decision[];
  decided_by?: DecidedBy;
  term?: string;
  justia_url?: string;
  written_opinion: WrittenOpinion[];
}

interface CaseDbSchema {
  _default: {
    [key: string]: Case
  }
}

interface Opinion {
  id: string;
  case_id: int;
  content: string;
}

interface OpinionDbSchema {
  _default: {
    [key: string]: Opinion
  }
}

// Create a type for the db object
