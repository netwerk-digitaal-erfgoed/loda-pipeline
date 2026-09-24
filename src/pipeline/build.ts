import { FileWriter, Pipeline } from "@lde/pipeline";
import { ConsoleReporter } from "@lde/pipeline-console-reporter";
import type { ApplicationConfig, PipelineConfig } from "../config.js";
import { createDatasetSelector } from "./dataset-selector.js";
import { createQleverImportResolver } from "./distribution-resolver.js";
import { createStages } from "./stage.js";
import { createEdmShaclValidator } from "./validator.js";

export async function build(config: {
	app: ApplicationConfig;
	pipeline: PipelineConfig;
}) {
	const datasetSelector = await createDatasetSelector(
		new URL(config.pipeline.dataset.uri),
		config.pipeline.directory,
		new URL(config.app.registryEndpoint),
	);

	const distributionResolver = await createQleverImportResolver(
		config.app.importsDir,
	);

	const validator = createEdmShaclValidator(
		config.app.validationEdmShapesPath,
		config.app.validationOutputDir,
	);

	const stages = await createStages(
		config.pipeline.directory,
		validator,
		config.app.stage,
	);

	const pipeline = new Pipeline({
		name: config.pipeline.name,
		datasetSelector,
		distributionResolver,
		stages,
		writers: new FileWriter({ outputDir: config.app.outputDir }),
		reporter: new ConsoleReporter(),
	});

	return { pipeline, distributionResolver };
}
