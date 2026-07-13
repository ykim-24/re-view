import { Workspace } from "@/features/workspace/Workspace";

interface PageProps {
  params: Promise<{ owner: string; repo: string; number: string }>;
}

export default async function PrPage({ params }: PageProps) {
  const { owner, repo, number } = await params;
  return (
    <Workspace owner={owner} repo={repo} number={Number(number)} />
  );
}
