package graph;

import api.ASIASim;
import api.LoadStartingData;
import bean.RetrievedDocument;
import graph.Node;
import ir.Preprocessing;

import java.io.IOException;

public class ASIASimilarity {

    private static Preprocessing preprocessing;

    public static void initializeASIA() throws IOException {
        preprocessing = LoadStartingData.getPreprocessing("./resources/stopword/stop-words-english.txt",
                "./resources/stopword/stop-words-java.txt",
                "./resources/androidAPI/android-API.csv",
                "./resources/androidAPI/android_constants.txt");
        ASIASim.Initialize(preprocessing, "./resources/idf-code-only-entire-dataset");
    }

    public static double computeSimilarity(Node n1, Node n2) throws Exception {
        RetrievedDocument res = ASIASim.CalculateSim(n1.getTokens(), n2.getTokens(),
                n1.getSplitTokens(), n2.getSplitTokens());
        return res.getSimilarityScore();
    }

    public static Preprocessing getPreprocessing() {
        return preprocessing;
    }
}
