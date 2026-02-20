package email

import (
	"bytes"
	"embed"
	htmltemplate "html/template"
	texttemplate "text/template"
)

//go:embed templates/*.html templates/*.txt
var emailTemplateFS embed.FS

func renderHTMLTemplate(name string, params RequestStatusNotificationParams) (string, error) {
	templatePath := "templates/" + name
	templateBytes, err := emailTemplateFS.ReadFile(templatePath)
	if err != nil {
		return "", err
	}

	tmpl, err := htmltemplate.New(name).Parse(string(templateBytes))
	if err != nil {
		return "", err
	}

	var out bytes.Buffer
	if err := tmpl.Execute(&out, params); err != nil {
		return "", err
	}

	return out.String(), nil
}

func renderTextTemplate(name string, params RequestStatusNotificationParams) (string, error) {
	templatePath := "templates/" + name
	templateBytes, err := emailTemplateFS.ReadFile(templatePath)
	if err != nil {
		return "", err
	}

	tmpl, err := texttemplate.New(name).Parse(string(templateBytes))
	if err != nil {
		return "", err
	}

	var out bytes.Buffer
	if err := tmpl.Execute(&out, params); err != nil {
		return "", err
	}

	return out.String(), nil
}
