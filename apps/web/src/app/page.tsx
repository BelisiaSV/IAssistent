import { redirect } from "next/navigation";

export default function HomePage() {
  // The proxy sends visitors without a session to /login.
  redirect("/teams");
}
