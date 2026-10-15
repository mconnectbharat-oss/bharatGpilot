import os
import sys 

### Import the routing function directly from your integration file

from ai_integration import query_bharat_gpilot 

def run_chat_interface(): 

### Simple check to alert user if keys are missing locally

if not os.environ.get("OPENROUTER_API_KEY") and not os.environ.get("HF_TOKEN"):
print("⚠️ Warning: Neither OPENROUTER_API_KEY nor HF_TOKEN found in environment variables.")
print("Please export your keys before starting, or run via GitHub Action Secrets.\n") 

print("====================================================")
print("🚀 Welcome to the BharatGpilot Terminal Interface")
print("====================================================")
print("Type your prompt and press Enter. Type 'exit' or 'quit' to close.\n") 

while True:
try: 

### Capture keyboard inputs cleanly

user_input = input("👤 You: ").strip() 

### Check for terminal exit commands

if user_input.lower() in ['exit', 'quit']:
print("\nShutting down BharatGpilot. Goodbye!")
break 

if not user_input:
continue 

print("\n🤖 BharatGpilot is thinking...") 

# Route inputs through the Grok -> Hugging Face engine

response = query_bharat_gpilot(user_input)

print(f"\n✨ Response:\n{response}")
print("\n" + "-"*50 + "\n")

except KeyboardInterrupt:
# Handle Ctrl+C interruptions cleanly
print("\n\nSession interrupted. Exiting...")
break
except Exception as e:
print(f"\n❌ An error occurred: {str(e)}\n") 

if **name** == "**main**":
run_chat_interface()