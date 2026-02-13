import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl);

interface ApiEntry {
  resource: string;
  accepts: Array<{
    description?: string;
    maxAmountRequired?: string;
    outputSchema?: {
      input?: {
        method?: string;
        bodySchema?: Record<string, any>;
        queryParams?: Record<string, any>;
        headerFields?: Record<string, any>;
      };
      output?: Record<string, any>;
    };
  }>;
}

interface EndpointResource {
  path: string;
  method: string;
  description?: string;
  cost: string;
  bodySchema?: Record<string, any>;
  queryParams?: Record<string, any>;
  headerFields?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

try {
  // Read the JSON from monorepo root
  const jsonPath = join(import.meta.dir, "../../../../base-sepolia-x402-apis.json");
  const entries: ApiEntry[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
  console.log(`Loaded ${entries.length} API entries from base-sepolia-x402-apis.json`);

  // Group entries by hostname
  const byHostname = new Map<string, EndpointResource[]>();

  for (const entry of entries) {
    if (!entry.resource || !entry.accepts?.[0]) continue;

    const url = new URL(entry.resource);
    const hostname = url.hostname;
    const accept = entry.accepts[0];
    const input = accept.outputSchema?.input;

    const resource: EndpointResource = {
      path: url.pathname,
      method: input?.method ?? "POST",
      cost: accept.maxAmountRequired ?? "0",
    };

    if (accept.description) {
      resource.description = accept.description;
    }
    if (input?.bodySchema && Object.keys(input.bodySchema).length > 0) {
      resource.bodySchema = input.bodySchema;
    }
    if (input?.queryParams && Object.keys(input.queryParams).length > 0) {
      resource.queryParams = input.queryParams;
    }
    if (input?.headerFields && Object.keys(input.headerFields).length > 0) {
      resource.headerFields = input.headerFields;
    }
    if (accept.outputSchema?.output && Object.keys(accept.outputSchema.output).length > 0) {
      resource.outputSchema = accept.outputSchema.output;
    }

    if (!byHostname.has(hostname)) {
      byHostname.set(hostname, []);
    }
    byHostname.get(hostname)!.push(resource);
  }

  console.log(`Grouped into ${byHostname.size} unique hostnames`);

  // Get existing endpoints from endpoint_scores
  const existingEndpoints = await sql<Array<{ endpoint: string }>>`
    SELECT endpoint FROM endpoint_scores
  `;
  const endpointSet = new Set(existingEndpoints.map((e) => e.endpoint));
  console.log(`Found ${endpointSet.size} endpoints in endpoint_scores`);

  // Update each matching endpoint
  let updated = 0;
  for (const [hostname, resources] of byHostname) {
    if (!endpointSet.has(hostname)) continue;

    await sql`
      UPDATE endpoint_scores
      SET resources = ${sql.json(resources)}
      WHERE endpoint = ${hostname}
    `;
    updated++;
    console.log(`  ${hostname}: ${resources.length} resources`);
  }

  console.log(`\nSeed complete: updated ${updated} endpoints with resources`);
} catch (err) {
  console.error("Seed resources failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
