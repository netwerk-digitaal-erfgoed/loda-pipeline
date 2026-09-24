import { resolve } from "node:path";
import { FileWriter } from "@lde/pipeline";
import { ShaclValidator } from "@lde/pipeline-shacl-validator";

export function createEdmShaclValidator(
	edmShapesPath: string,
	outputDir: string,
): ShaclValidator {
	return new ShaclValidator({
		shapesFile: resolve(edmShapesPath),
		reportWriters: [new FileWriter({ outputDir })],
	});
}
