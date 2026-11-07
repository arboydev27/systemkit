import test from "node:test";
import assert from "node:assert/strict";
import { formatPercent, formatUsers, SCALE_CALM, SCALE_ROUNDS, SCALE_START, scaleFlow, scaleNodes, scaleRoutes, systemLoad, withFix } from "../src/lib/scale-game.ts";

test("nothing is failing before the surge", () => {
  assert.equal(systemLoad(SCALE_START, SCALE_CALM.requests).failing, 0);
});

test("every round opens with requests failing, and only its answer stops them", () => {
  for (const round of SCALE_ROUNDS) {
    assert.ok(systemLoad(round.system, round.requests).failing > 0.5, `${round.users} should open in trouble`);
    assert.equal(round.fixes.length, 3);
    for (const fix of round.fixes) {
      const failing = systemLoad(withFix(round, fix.id), round.requests).failing;
      if (fix.id === round.answer) assert.equal(failing, 0, fix.id);
      else assert.ok(failing > 0, `${fix.id} shouldn't solve ${round.users}`);
    }
  }
});

test("each round starts from what the last one built, with servers growing to match traffic", () => {
  for (let index = 1; index < SCALE_ROUNDS.length; index++) {
    const before = withFix(SCALE_ROUNDS[index - 1], SCALE_ROUNDS[index - 1].answer);
    const next = SCALE_ROUNDS[index].system;
    assert.deepEqual({ ...next, servers: 0 }, { ...before, servers: 0 });
    assert.ok(next.servers > before.servers);
    assert.ok(systemLoad(next, SCALE_ROUNDS[index].requests).server <= 1, "the new round's trouble isn't the servers");
  }
});

test("the reasons the notes give are true of the model", () => {
  const [first, second, third] = SCALE_ROUNDS;
  // A cache doesn't help an overloaded server, though it does ease the database.
  const cached = withFix(first, "add-cache");
  assert.equal(systemLoad(cached, first.requests).server, systemLoad(first.system, first.requests).server);
  assert.ok(systemLoad(cached, first.requests).database < systemLoad(first.system, first.requests).database);
  // More servers don't touch the database.
  assert.equal(systemLoad(withFix(second, "more-servers"), second.requests).database, systemLoad(second.system, second.requests).database);
  // A bigger database is better, but not enough.
  const bigger = systemLoad(withFix(second, "bigger-database"), second.requests);
  assert.ok(bigger.failing > 0 && bigger.failing < systemLoad(second.system, second.requests).failing);
  // Neither replicas nor a bigger cache reduce writes below what one database can take.
  const writesAlone = (third.requests * 0.1) / 5_000;
  for (const id of ["replicas", "bigger-cache"]) assert.ok(systemLoad(withFix(third, id), third.requests).database > writesAlone);
  assert.ok(writesAlone > 1, "writes alone are too much for one database");
});

test("the map draws one node per tier, or a stack of three for many, and labels each tier once", () => {
  const simple = scaleNodes(SCALE_START, 100);
  assert.deepEqual(simple.map((node) => node.kind), ["users", "server", "database"]);
  const full = scaleNodes(withFix(SCALE_ROUNDS[2], "shard"), SCALE_ROUNDS[2].requests);
  assert.deepEqual([...new Set(full.map((node) => node.kind))], ["users", "balancer", "server", "cache", "database"]);
  assert.equal(full.filter((node) => node.kind === "server").length, 3);
  assert.equal(full.filter((node) => node.kind === "database").length, 3);
  assert.equal(full.filter((node) => node.label).length, 5);
  assert.equal(new Set(full.map((node) => node.id)).size, full.length);
  for (const node of full) assert.ok(node.x >= 0 && node.x <= 1 && node.y >= 0 && node.y <= 1);
  assert.equal(full.find((node) => node.label === "16 shards")?.kind, "database");
  assert.equal(full.find((node) => node.label === "160 servers")?.kind, "server");
});

test("a stacked tier keeps its middle node, so a server slides rather than vanishing when it becomes many", () => {
  const one = scaleNodes(SCALE_START, 100).find((node) => node.kind === "server");
  const many = scaleNodes({ ...SCALE_START, servers: 4, balancer: true }, 100).filter((node) => node.kind === "server");
  assert.ok(many.some((node) => node.id === one.id));
});

test("routes pass through one node of each tier, in order", () => {
  const nodes = scaleNodes({ ...SCALE_START, servers: 4, balancer: true, shards: 16 }, 100);
  const routes = scaleRoutes(nodes);
  assert.equal(routes.length, 9);
  for (const route of routes) {
    assert.equal(route.length, 4);
    assert.equal(route[0], "users-1");
    assert.equal(route[1], "balancer-1");
  }
});

test("the flow loses requests at an overloaded tier and stops cache hits at the cache", () => {
  const round = SCALE_ROUNDS[0];
  const nodes = scaleNodes(round.system, round.requests);
  const flow = scaleFlow(round.system, round.requests, nodes);
  assert.ok(flow.drop["server-1"] > 0.7);
  assert.equal(flow.drop["database-1"], 0);
  const cached = withFix(SCALE_ROUNDS[1], "add-cache");
  const settled = scaleFlow(cached, SCALE_ROUNDS[1].requests, scaleNodes(cached, SCALE_ROUNDS[1].requests));
  assert.ok(settled.absorb["cache-1"] > 0.5);
  assert.ok(Object.values(settled.drop).every((share) => share === 0));
  assert.ok(settled.rate > flow.rate);
});

test("values read the way the game shows them", () => {
  assert.equal(formatUsers(250_000), "250K");
  assert.equal(formatUsers(1_000_000), "1M");
  assert.equal(formatUsers(10_000_000), "10M");
  assert.equal(formatPercent(0.714), "71%");
});
