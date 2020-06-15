package graph;

public class Edge {

    private Node node1;
    private Node node2;
    private double weight;

    public Edge(Node node1, Node node2, double weight) {
        this.node1 = node1;
        this.node2 = node2;
        this.weight = weight;
    }

}
