import { mkdir } from "node:fs/promises";
import { ImportResolver, SparqlDistributionResolver } from "@lde/pipeline";
import { createQlever } from "@lde/sparql-qlever";

export async function createQleverImportResolver(
	importsDir: string,
	qleverMemoryGb: number,
): Promise<ImportResolver> {
	// Set up QLever for importing data.
	await mkdir(importsDir, { recursive: true });

	const qlever = createQlever({
		mode: "docker",
		image: "adfreiburg/qlever",
		containerName: "loda-qlever",
		dataDir: importsDir,
		serverOptions: { "memory-max-size": `${qleverMemoryGb}G` },
	});

	// Always import data dumps into QLever rather than using remote SPARQL endpoints.
	return new ImportResolver(new SparqlDistributionResolver(), {
		importer: qlever.importer,
		server: qlever.server,
		strategy: "import",
	});
}
