import { resolve } from "node:path";
import { FileWriter } from "@lde/pipeline";
import { ShaclValidator } from "@lde/pipeline-shacl-validator";

export function createEdmShaclValidator(): ShaclValidator {
	return new ShaclValidator({
		shapesFile: resolve("pipelines/generic/edm_ext_shacl_shapes.ttl"),
		reportWriters: [new FileWriter({ outputDir: "./output/validation" })],
	});
}
