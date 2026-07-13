import { NextResponse } from "next/server";
import {
  listSavedRepos,
  removeRepo,
  saveRepo,
} from "@/infrastructure/db/repos.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    return NextResponse.json({ repos: listSavedRepos() });
  } catch (err) {
    return errorResponse(err);
  }
}

interface RepoAction {
  action: "save" | "remove";
  owner?: string;
  repo?: string;
  key?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RepoAction;
    if (body.action === "save" && body.owner && body.repo) {
      saveRepo(body.owner, body.repo);
      return NextResponse.json({ repos: listSavedRepos() });
    }
    if (body.action === "remove" && body.key) {
      removeRepo(body.key);
      return NextResponse.json({ repos: listSavedRepos() });
    }
    return NextResponse.json({ error: "Invalid repo action" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
