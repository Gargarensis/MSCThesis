package graph;

import java.util.ArrayList;
import java.util.List;

public class Graph {

    private List<Node> nodes;
    private List<Edge> edges = new ArrayList<Edge>();

    public Graph(List<Node> nodes) {
        this.nodes = nodes;
    }

    public void addEdge(Edge e) {
        this.edges.add(e);
    }

    public List<Node> getNodes() {
        return nodes;
    }

    public List<Edge> getEdges() {
        return edges;
    }
}
