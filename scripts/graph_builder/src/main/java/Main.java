import graph.ASIASimilarity;
import graph.Node;

import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

public class Main {

    public static final double SIMILARITY_THRESHOLD = 0.9d;

    // RUN USING java -classpath .:../../lib/asia.jar Main ../../../snippets.csv
    public static void main(String[] args) throws Exception {
        System.out.println(new java.util.Date());
        System.out.println("ASIA initialization...");
        ASIASimilarity.initializeASIA();

        System.out.println(new java.util.Date());
        System.out.println("Nodes generation...");
        // Takes as input args[0] the "snippets.csv" file generated with Python
        List<Node> nodes = CSVSnippetParser.parseSnippetsFromCSV(args[0]);
//        Graph g = new Graph(nodes);

        System.out.println(new java.util.Date());
        System.out.println("Calculating similarities...");
        AtomicInteger edgeCount = new AtomicInteger();
        AtomicInteger nodeCount = new AtomicInteger();
        ArrayList<String> csvFlush = new ArrayList<>();
        IntStream.range(0, nodes.size()).parallel().forEach(
                i -> {
                    try {
                        Node node1 = nodes.get(i);
//                        System.out.println(i);

                        for (int j = i+1; j < nodes.size(); j++) {
                            Node node2 = nodes.get(j);
                            double similarity = ASIASimilarity.computeSimilarity(node1, node2);

                            if (similarity < SIMILARITY_THRESHOLD) {
                                continue;
                            }

                            edgeCount.set(edgeCount.get() + 1);

                            synchronized (csvFlush) {
                                if (csvFlush.size() == 100000) {
                                    try(FileWriter fw = new FileWriter("./graph.csv", true);
                                        BufferedWriter bw = new BufferedWriter(fw);
                                        PrintWriter out = new PrintWriter(bw))
                                    {
                                        for (int k = 0; k < 100000; k++) {
                                            out.println(csvFlush.get(k));
                                        }

                                        csvFlush.subList(0, 100000).clear();

                                    } catch (IOException e) {
                                        System.out.println(e.getMessage());
//                                        e.printStackTrace();
                                    }
                                } else {
                                    csvFlush.add(node1.getId() + "," + node2.getId() + "," + similarity);
                                }
                            }

//                            Edge e = new Edge(node1, node2, similarity);
//                            node1.addEdge(e);
//                            node2.addEdge(e);
//                            g.addEdge(e);
                        }
                    } catch (Exception ex) {
                        System.out.println(ex.getMessage());
//                        ex.printStackTrace();
                    }


                    // TODO: remove this to remove the limit
                    if (nodeCount.get() == 100000) {
                        synchronized (csvFlush) {
                            try(FileWriter fw = new FileWriter("./graph.csv", true);
                                BufferedWriter bw = new BufferedWriter(fw);
                                PrintWriter out = new PrintWriter(bw))
                            {
                                for (int k = 0; k < csvFlush.size(); k++) {
                                    out.println(csvFlush.get(k));
                                }

                                // Remove the first 100 elements
                                csvFlush.subList(0, csvFlush.size()).clear();

                            } catch (IOException e) {
                                System.out.println(e.getMessage());
                                //e.printStackTrace();
                            }
                        }
                        System.out.println(new java.util.Date());
                        System.exit(0);
                    }

                    nodeCount.set(nodeCount.get() + 1);
                    if (nodeCount.get() % 1000 == 0) {
                        System.out.println(nodeCount.get() + "/" + nodes.size());
                    }
                }
        );

//        for (int i = 0; i < nodes.size(); i++) {
//            Node node1 = nodes.get(i);
//            System.out.println(i);
//
//            for (int j = i+1; j < nodes.size(); j++) {
//                Node node2 = nodes.get(j);
//                double similarity = ASIASimilarity.computeSimilarity(node1, node2);
//
//                Edge e = new Edge(node1, node2, similarity);
//                node1.addEdge(e);
//                node2.addEdge(e);
//                g.addEdge(e);
//            }
//        }
        System.out.println(new java.util.Date());
        System.out.println("Finished! Number of edges: " + edgeCount.get());
        try(FileWriter fw = new FileWriter("./graph.csv", true);
            BufferedWriter bw = new BufferedWriter(fw);
            PrintWriter out = new PrintWriter(bw))
        {
            for (int k = 0; k < csvFlush.size(); k++) {
                out.println(csvFlush.get(k));
            }

            // Remove the first 100 elements
            csvFlush.subList(0, csvFlush.size()).clear();

        } catch (IOException e) {
            System.out.println(e.getMessage());
            //e.printStackTrace();
        }
//        System.out.println(g.getEdges().size());
    }
}
