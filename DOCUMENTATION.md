# WhatsApp Automation System Documentation

## 🚀 Postman Collection

You can test the webhook locally using these sample payloads.

### 1. Webhook Verification (GET)
- **URL**: `http://localhost:3000/webhook`
- **Method**: `GET`
- **Params**:
  - `hub.mode`: `subscribe`
  - `hub.verify_token`: `your_verify_token` (must match `.env`)
  - `hub.challenge`: `123456789`
- **Expected Response**: `123456789`

### 2. Simulate Text Message (POST)
- **URL**: `http://localhost:3000/webhook`
- **Method**: `POST`
- **Body (JSON)**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "123456789",
              "phone_number_id": "997740520096889"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "1234567890"
              }
            ],
            "messages": [
              {
                "from": "1234567890",
                "id": "wamid.HBgLMTIzNDU2Nzg5MAVFAfID",
                "timestamp": "1670000000",
                "text": {
                  "body": "hi"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### 3. Simulate Button Reply (POST)
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "997740520096889" },
            "contacts": [{ "profile": { "name": "John Doe" }, "wa_id": "1234567890" }],
            "messages": [
              {
                "from": "1234567890",
                "type": "interactive",
                "interactive": {
                  "type": "button_reply",
                  "button_reply": { "id": "VIEW_MENU", "title": "View Menu 🍕" }
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

## 📦 Sample Menu Data
The menu is stored in `utils/menu.json`.

## 🚢 Deployment Steps

### Render (Recommended)
1. Push your code to a GitHub repository.
2. Create a new "Web Service" on Render.
3. Connect your GitHub repository.
4. Set Environment Variables (`PORT`, `MONGODB_URI`, `VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`).
5. Set Build Command: `npm install`
6. Set Start Command: `npm start`
7. Copy the public URL provided by Render and use it as your Webhook URL in Meta Developer Portal (e.g., `https://your-app.onrender.com/webhook`).

### VPS (Ubuntu/Nginx)
1. SSH into your VPS.
2. Install Node.js, NPM, and PM2: `sudo apt install nodejs npm && npm install -g pm2`.
3. Clone your repository.
4. Create a `.env` file with your credentials.
5. Start the app: `pm2 start server.js --name whatsapp-bot`.
6. Set up Nginx as a reverse proxy to forward traffic from port 80 to 3000.
7. Use `certbot` for SSL (Meta requires HTTPS).

## 🔐 Meta API Setup
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Create a "Business" app.
3. Add "WhatsApp" to your app.
4. Get your `PHONE_NUMBER_ID` and `WHATSAPP_TOKEN` (Permanent Token recommended).
5. In "Webhook" settings, point to your deployed URL `/webhook` and use the `VERIFY_TOKEN` you defined.
6. Subscribe to "messages" in Webhook fields.
