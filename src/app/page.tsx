import Link from "next/link";
import Button from "../components/ui/Button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7FAFC]">
      <h1 className="text-4xl font-bold text-[#2D3748] mb-6">
        Church Management System
      </h1>
      <Link href="/dashboard">
        <Button>Enter Dashboard</Button>
      </Link>
    </div>
  );
}
