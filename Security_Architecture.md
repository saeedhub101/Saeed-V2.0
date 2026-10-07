# Saeed V2.0 — Security Architecture

**Status:** Authoritative security contract

## 1. Security principle

Saeed operates with the minimum authority necessary to complete an approved action.

Convenience must never bypass the permission boundary.

## 2. Trust zones

The system is divided into:

- User/UI
- Core
- Brain/LLM
- Tool Registry
- Permission Manager
- Local capabilities
- Plugins/add-ons
- External providers
- Persistent storage

Lower-trust input must never directly control higher-trust operations.

## 3. LLM is untrusted for execution

LLM output is semantic intent, not authorization.

The LLM may request an operation. It cannot grant permission, bypass validation, access credentials directly, manipulate Character bones, invoke hidden tools or redefine security policy.

## 4. Tool security

Every tool:

- declares permissions
- validates input
- receives only required context
- executes through the central registry
- reports structured success/failure
- supports cancellation where appropriate

Destructive or high-impact operations require explicit policy handling.

## 5. Plugin isolation

Plugins are untrusted optional components.

A plugin must not:

- become Core
- replace the Tool Registry
- bypass permissions
- access unrelated secrets
- remain alive after its lifecycle owner ends

A plugin crash must be isolated from Core.

## 6. Credentials

Secrets must never be stored in source code, architecture documents, ordinary settings files, diagnostics or chat transcripts unless explicitly intended.

Credentials use the application's secure credential mechanism.

Logs and error reports must redact secrets.

## 7. Network boundary

External network access is explicit.

The application must know which subsystem/provider is making the request.

Unexpected background network activity is an architectural violation unless explicitly documented.

## 8. Data minimization

Only data required for a task should cross a subsystem/provider boundary.

Do not send unrelated conversation data, unrelated files, credentials, hidden application state or private Character runtime internals to an external provider.

## 9. Character privacy boundary

Character is not a security authority.

Character behavior must not approve permissions, execute tools directly, expose secrets, silently transmit data or create hidden network connections.

## 10. Logging

Logs should support diagnosis without becoming a data-exfiltration path.

Redact API keys, access tokens, passwords, credential material, sensitive file contents and unnecessary private provider payloads.

Logs should rotate and have bounded retention.

## 11. Emergency Stop

A global Emergency Stop must be capable of stopping active high-impact actions without requiring full application shutdown.

It should stop, where applicable:

- tool chains
- automation
- mouse/keyboard control
- autonomous actions
- pending executable workflows

Emergency Stop must not delete persistent data.

## 12. Security invariants

1. LLM output is never authorization.
2. No tool bypasses the permission boundary.
3. No plugin bypasses the Tool Registry.
4. Secrets never appear in logs.
5. External providers receive only required data.
6. Character cannot authorize system actions.
7. Optional components fail closed where practical.
8. Emergency Stop remains available while high-impact actions are active.
9. Destroyed components lose access to runtime resources.
10. Security policy cannot be changed by an untrusted request.
