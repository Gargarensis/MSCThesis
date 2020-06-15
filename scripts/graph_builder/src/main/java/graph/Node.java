package graph;

import api.ASIASim;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Node {

    private int id;
    private String code;
    private List<Edge> edges = new ArrayList<Edge>();
    private String[] tokens;
    private Map<String, Double> splitTokens;

    public Node(int id, String code) {
        this.id = id;
        this.code = code;

        String cleanedText = ASIASimilarity.getPreprocessing().CleanText(code);
        tokens = ASIASimilarity.getPreprocessing().SplitForAndroidSim(cleanedText);
        splitTokens = ASIASimilarity.getPreprocessing().SplitAndTokenize(cleanedText);
    }

    public int getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public void addEdge(Edge e) {
        edges.add(e);
    }

    public String[] getTokens() {
        return tokens;
    }

    public Map<String, Double> getSplitTokens() {
        return splitTokens;
    }
}
