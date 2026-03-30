# Admin de Ventas Unificadas

Sistema administrativo simple para consolidar ventas de:

- Tiendanube
- Shopify
- MercadoLibre

Y exportarlas a Google Sheets con desglose de:

- Ventas brutas
- Descuentos
- IIBB
- Impuestos
- Comisiones de marketplace
- Neto

## Stack

- Next.js 16 (App Router + API routes)
- TypeScript
- Tailwind CSS v4 (con estilos custom)
- Google Sheets API (`googleapis`)
- Persistencia local JSON para MVP (`data/sales.json`)
- Configuracion operativa local (`data/settings.json`, `data/runs.json`)

## Puesta en marcha

1. Instalar dependencias

```bash
npm install
```

2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Completa en `.env.local`:

- `GOOGLE_SERVICE_ACCOUNT_JSON` con el JSON del service account en una sola linea
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_TAB` (opcional, por defecto `Ventas`)
- `AUTOMATION_API_KEY` (opcional para proteger el endpoint de automatizaciones)

3. Correr en local

```bash
npm run dev
```

Abrir http://localhost:3000

## Docker (demo cliente)

1. Construir imagen

```bash
docker build -t tienda-demo .
```

2. Ejecutar contenedor

```bash
docker run --rm -p 3000:3000 --env-file .env.local tienda-demo
```

Abrir http://localhost:3000

Opcional: si queres persistir cambios en datos locales (`data/*.json`) entre corridas del contenedor:

```bash
docker run --rm -p 3000:3000 --env-file .env.local -v ${PWD}/data:/app/data tienda-demo
```

## Endpoints

- `POST /api/sync`
	- Body:
	```json
	{
		"from": "2026-03-01T00:00:00.000Z",
		"to": "2026-03-23T23:59:59.999Z",
		"channels": ["tiendanube", "shopify", "mercadolibre"]
	}
	```
	- Trae ventas por canal (mock actualmente), las normaliza y guarda sin duplicados.

- `GET /api/sales?from=...&to=...&channels=tiendanube,shopify`
	- Devuelve items y totales consolidados.

- `POST /api/export/sheets`
	- Body:
	```json
	{
		"from": "2026-03-01T00:00:00.000Z",
		"to": "2026-03-23T23:59:59.999Z",
		"channels": ["tiendanube", "shopify", "mercadolibre"]
	}
	```
	- Exporta a Google Sheets la grilla filtrada.
	- Si faltan variables de Google, el panel ahora hace fallback y descarga un XLS de toda la tienda.

- `GET /api/export/xls`
	- Descarga un archivo XLS compatible con Excel desde los datos locales.
	- Query params opcionales:
		- `all=1` para exportar toda la tienda
		- `from`, `to`, `channels=tiendanube,shopify` para exportar un filtro

- `GET /api/export/xls/products`
	- Descarga XLS de productos Tiendanube desde API real.
	- Query params opcionales:
		- `limit=1000`
		- `q=texto` para filtrar por nombre, ID o SKU

- `GET /api/settings`
	- Devuelve conexiones, exportacion y automatizaciones configuradas en el admin.

- `PUT /api/settings`
	- Persiste cambios del admin operativo.

- `GET /api/runs`
	- Devuelve historial de corridas de sincronizacion.

- `POST /api/connections/test`
	- Valida una conexion individual enviada desde el admin.
	- Shopify y Tiendanube ya estan implementados en modo API real.

- `GET /api/tiendanube/products?limit=300`
	- Devuelve catalogo de productos de Tiendanube desde API real.
	- Requiere conexion Tiendanube en modo `api` con token valido.

- `GET /api/oauth/tiendanube/start`
	- Inicia el flujo OAuth de Tiendanube y redirige a la pantalla de autorizacion.

- `GET /api/oauth/tiendanube/callback`
	- Recibe `code` + `state`, canjea token y guarda `accessToken` + `user_id` en settings.

- `POST /api/automation/run-due`
	- Ejecuta automatizaciones vencidas.
	- Si definis `AUTOMATION_API_KEY`, enviar header `x-automation-key`.

## Estructura

- `src/components/admin-dashboard.tsx`: UI del panel
- `src/app/api/sync/route.ts`: sincronizacion de canales
- `src/app/api/sales/route.ts`: consulta consolidada
- `src/app/api/export/sheets/route.ts`: exportacion a Sheets
- `src/lib/connectors.ts`: conectores por canal
- `src/lib/shopify.ts`: integracion real con Shopify Admin GraphQL API
- `src/lib/normalizer.ts`: normalizacion y calculo de neto
- `src/lib/storage.ts`: persistencia local JSON
- `src/lib/settings.ts`: configuracion de conexiones y corridas
- `src/lib/sync-service.ts`: orquestacion de sincronizacion y automatizaciones
- `src/lib/metrics.ts`: agregacion de totales
- `src/lib/sheets.ts`: integracion con Google Sheets API

## Formula de neto en el MVP

`neto = total - descuentos - comision marketplace - impuestos - iibb - otros cargos`

Si tu criterio contable difiere, se ajusta en `src/lib/normalizer.ts`.

## Admin operativo

La pantalla principal ahora permite:

- Configurar cada canal en modo `demo` o `api`
- Guardar nombre de tienda, URL y credenciales base
- Definir spreadsheet y tab de exportacion
- Crear jobs automáticos diarios u horarios
- Ver historial de corridas exitosas o fallidas
- Probar la conexion de cada canal desde el panel

## Shopify real

Shopify ya quedo implementado en modo API real.

### Que cargar en el admin

- Canal: `shopify`
- Modo: `api`
- Store URL: `mitienda.myshopify.com`
- Access Token: token de Admin API

### Como obtener el token

1. Entrar al admin de la tienda.
2. Ir a `Apps`.
3. Entrar en `Develop apps`.
4. Crear una app custom.
5. Dar permisos de Admin API.
6. Instalar la app.
7. Copiar el `Admin API access token`.

### Scopes minimos sugeridos

- `read_orders`
- `read_customers`

### Que trae hoy la integracion

- Fecha de pedido
- Order ID
- Cliente
- Total actual
- Descuentos actuales
- Shipping actual
- Impuestos actuales

Por ahora Shopify se mapea con:

- `marketplaceFee = 0`
- `iibb = 0`
- `otherCharges = 0`

Esos conceptos siguen dependiendo de reglas fiscales propias o integraciones financieras complementarias.

## Produccion

Para llevarlo a produccion, el esquema recomendado es:

1. Publicar la app en Railway, Render o Vercel.
2. Programar un cron externo que pegue a `POST /api/automation/run-due`.
3. Migrar persistencia a PostgreSQL.
4. Reemplazar `src/lib/connectors.ts` por clientes reales OAuth/token de cada canal.

## Proximo paso recomendado

Implementar MercadoLibre API real (OAuth + refresh token) y mover persistencia a PostgreSQL para auditoria y escalabilidad.

## Tiendanube real (OAuth)

Tiendanube quedo integrada con OAuth de authorization code y consumo real de Orders API.

### Configuracion en Partners

1. En la app de Partners, cargar una URL publica del admin de este sistema en `Pagina de la aplicacion`.
2. Cambiar `URL para redirigir despues de la instalacion` a:

```text
https://TU_DOMINIO/api/oauth/tiendanube/callback
```

No usar la URL default de partners (`https://partners.tiendanube.com/applications/authentication/{app_id}`), porque ahi no recibis el flujo completo para tu app.

### Configuracion en el panel de este proyecto

1. En `Conexiones > tiendanube`, cargar:
	- `Client ID` = app_id de Tiendanube
	- `Client Secret` = client_secret de la app
2. Guardar configuracion.
3. Click en `Conectar OAuth`.
4. Aceptar permisos en Tiendanube.
5. Volver al dashboard: se guarda automaticamente `accessToken` y `user_id/store_id`.

### Scopes sugeridos para este MVP

- `read_orders`
- `read_customers` (opcional si queres enriquecer nombre del cliente)

### Notas importantes

- El header para API de Tiendanube es `Authentication: bearer TOKEN` (no `Authorization`).
- `bearer` debe ir en minuscula.
- El `code` del callback vence en 5 minutos y se usa una sola vez.
