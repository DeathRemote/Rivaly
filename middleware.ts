import { auth } from "./src/auth";

export default auth((req) => {
  const { nextUrl } = req;

  // Protect the dashboard.
  if (!req.auth && nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  // Keep auth pages clean: if already signed in, go to the app.
  if (req.auth && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
    return Response.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return;
});

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
