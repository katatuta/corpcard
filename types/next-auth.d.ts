import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      nickname: string;
      role: string;
      mode: string;
    };
  }

  interface User {
    id: string;
    email: string;
    nickname: string;
    role: string;
    mode: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    nickname: string;
    role: string;
    mode: string;
  }
}
