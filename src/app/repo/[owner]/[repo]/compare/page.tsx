import { CompareView } from "@/features/compare/CompareView";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ base?: string; head?: string }>;
}

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { owner, repo } = await params;
  const { base = "", head = "" } = await searchParams;
  return <CompareView owner={owner} repo={repo} base={base} head={head} />;
}
