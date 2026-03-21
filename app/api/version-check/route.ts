import { NextResponse } from "next/server";
import { execSync } from "child_process";

const REPO = "Tacombel/eve-frontier-blueprints";
const BRANCH = "main";

function getLocalCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function GET() {
  const localCommit = getLocalCommit();
  if (!localCommit) {
    return NextResponse.json({ error: "Could not read local git commit" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 }, // cache 5 min
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "GitHub API error" }, { status: 502 });
    }

    const data = await res.json();
    const remoteCommit: string = data.sha;
    const upToDate = localCommit === remoteCommit;

    return NextResponse.json({ upToDate, localCommit: localCommit.slice(0, 7), remoteCommit: remoteCommit.slice(0, 7) });
  } catch {
    return NextResponse.json({ error: "Network error reaching GitHub" }, { status: 502 });
  }
}
