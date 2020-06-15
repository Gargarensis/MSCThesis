import graph.Node;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class CSVSnippetParser {

    public static final String CSV_SEPARATOR = "█";

    public static List<Node> parseSnippetsFromCSV(String csvFile) throws IOException {
        List<Node> result = new ArrayList<Node>();

        BufferedReader csvReader = new BufferedReader(new FileReader(csvFile));

        // First line is the header
        String row = csvReader.readLine();
        while ((row = csvReader.readLine()) != null) {
            String[] data = row.split(CSV_SEPARATOR);

            result.add(new Node(Integer.parseInt(data[0]), data[1]));
        }
        csvReader.close();

        return result;
    }
}
