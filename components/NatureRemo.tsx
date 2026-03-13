"use client";
import { Alert, Box, Button, CircularProgress, TextField } from "@mui/material";
import dynamic from "next/dynamic";
import { useState } from "react";

const DynamicReactJson = dynamic(() => import("react-json-view"), {
  ssr: false,
});

export default function NatureRemo() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<object | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGetButtonClick = async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("https://api.nature.global/1/appliances", {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("取得出来ませんでした");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 4,
        width: "100%",
      }}
    >
      <h1>nature remo home assistant</h1>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mt: 4,
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <TextField
          label="トークン"
          variant="outlined"
          fullWidth
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button
          variant="contained"
          onClick={handleGetButtonClick}
          disabled={loading || !token}
        >
          {loading ? <CircularProgress size={24} /> : "取得"}
        </Button>
      </Box>

      <Box sx={{ mt: 4, width: "100%", maxWidth: "800px", textAlign: "left" }}>
        {error && <Alert severity="error">{error}</Alert>}
        {data && (
          <DynamicReactJson
            src={data}
            theme="monokai"
            collapsed={2}
            displayObjectSize={true}
            displayDataTypes={true}
            enableClipboard={true}
          />
        )}
      </Box>
    </Box>
  );
}
