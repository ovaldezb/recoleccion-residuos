# Recolección Residuos Bot (WhatsApp)

Bot de WhatsApp para la gestión y recolección de residuos, integrado con Google Sheets para el almacenamiento de datos y desplegado en AWS Lambda usando Serverless Framework.

## Características
- 🤖 Flujo conversacional automatizado vía WhatsApp.
- 📍 Captura de ubicación GPS.
- 📅 Selección de días mediante listas interactivas.
- 📝 Registro de comentarios adicionales.
- 📊 Integración directa con Google Sheets (Hojas de Cálculo).
- ⚙️ Control de disponibilidad mediante bandera `SERVICE_ACTIVE`.
- 🚀 CI/CD con GitHub Actions para deploys en múltiples regiones.

## Requisitos
- Node.js 20+
- Serverless Framework (`npm install -g serverless`)
- Cuenta en Meta for Developers (WhatsApp Business API)
- Cuenta en Google Cloud Console (Service Account para Sheets)
- AWS CLI configurado

## Variables de Entorno (.env)
Crea un archivo `.env` basado en `.env.example`:
```bash
WHATSAPP_TOKEN=tu_token_aqui
VERIFY_TOKEN=tu_token_de_verificacion
GOOGLE_SHEET_ID=id_de_tu_hoja
GOOGLE_SERVICE_ACCOUNT_EMAIL=email_de_tu_service_account
GOOGLE_PRIVATE_KEY="tu_llave_privada_aqui"
PhoneNumberID=tu_phone_number_id
SERVICE_ACTIVE=true
```

## CI/CD con GitHub Actions
El deploy automático está configurado para las siguientes ramas:
- `develop`: Despliega al stage `dev` en la región definida por `AWS_REGION_DEVELOP`.
- `main`: Despliega al stage `prod` en la región definida por `AWS_REGION_MAIN`.

### Secretos en GitHub
Para activar el deploy automático, agrega estos secretos en el repositorio:
- `AWS_ACCESS_KEY_ID_DEVELOP`
- `AWS_SECRET_ACCESS_KEY_DEVELOP`
- `AWS_REGION_DEVELOP`
- `AWS_ACCESS_KEY_ID_MAIN`
- `AWS_SECRET_ACCESS_KEY_MAIN`
- `AWS_REGION_MAIN`

## Despliegue Manual
```bash
npm install
npx serverless deploy --stage dev --region us-west-1
```
