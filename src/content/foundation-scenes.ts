import foundation from "./foundation-diagrams.json";
import ordinaryScale from "./diagrams/ordinary-scale.json";
import storageEngines from "./diagrams/storage-engines.json";
import replication from "./diagrams/replication.json";
import transactions from "./diagrams/transactions.json";
import consensus from "./diagrams/consensus.json";
import streams from "./diagrams/streams.json";
import patterns from "./diagrams/patterns.json";

// Every chapter drawn by FoundationDiagram, keyed by diagram id. Ids are unique across files.
export const foundationScenes = {
  ...foundation, ...ordinaryScale, ...storageEngines, ...replication, ...transactions, ...consensus, ...streams, ...patterns,
};
