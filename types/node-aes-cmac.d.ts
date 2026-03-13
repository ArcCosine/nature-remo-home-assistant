declare module "node-aes-cmac" {
  export function aesCmac(
    key: string | Buffer,
    message: string | Buffer,
    options?: { returnAsBuffer?: boolean },
  ): string | Buffer;
}
