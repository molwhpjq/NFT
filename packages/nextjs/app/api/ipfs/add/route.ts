import { ipfsClient } from "~~/utils/simpleNFT/ipfs";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = JSON.stringify(body);
    const pinataJWT = process.env.PINATA_JWT;

    if (!pinataJWT) {
      return new NextResponse(JSON.stringify({ error: "No JWT token found" }), { status: 400 });
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJWT}`,
      },
      body: data,
    });

    if (!response.ok) {
      return new NextResponse(JSON.stringify({ error: "Error adding to IPFS" }), { status: 500 });
    }

    const res = await response.json();
    return new NextResponse(JSON.stringify({ IpfsHash: res.IpfsHash }), { status: 200 });
  } catch (error) {
    console.error("Error adding to IPFS", error);
    return new NextResponse(JSON.stringify({ error: "Error adding to IPFS" }), { status: 500 });
  }
}