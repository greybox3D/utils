import { runBenchmark } from "./transaction-vs-batch";

console.log("Starting benchmarks...");
runBenchmark().then(() => {
	console.log("Benchmarks complete!");
	process.exit(0);
});
