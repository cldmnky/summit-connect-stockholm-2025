package main

import (
	"embed"

	"github.com/cldmnky/summit-connect-stockholm-2025/cmd"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/server"
)

//go:embed frontend/*
var FrontendFS embed.FS

func main() {
	// Set the embedded frontend for the server
	server.SetEmbeddedFrontend(&FrontendFS)

	cmd.Execute()
}
