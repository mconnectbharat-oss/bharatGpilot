python 
import os
import sys
from openai import OpenAI

def query_free_model(prompt: str, model_name: str = "llama3-8b-8192"):
    # Grab your API key from the environment/GitHub Secret
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        print("Error: Missing GROQ_API_KEY in environment or Repository Secrets.", file=sys.stderr)
        sys.exit(1)

    # Initialize client targeting Groq's open-weights API layer
    client = OpenAI(
        base_url="https://groq.com",
        api_key=api_key
    )
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are BharatGpilot, an AI assistant project"},
                {"role": ""content": prompt}
            ],
            model=model_name
        )
        return response.choices.message.content
    except Exception as e:
        return f"Error executing model request: {str(e)}"

if __name__ == "__main__":
    test_output = query_free_model("Write a hello world script in Python.")
    print(test_output)
python 
import os
import sys
import requests
from openai import OpenAI

def query_grok(prompt: str):
    """Queries xAI's Grok-2 model using OpenRouter credentials."""
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    
    if not openrouter_key:
        print("Grok Alert: OPENROUTER_API_KEY is not set. Trying fallback...", file=sys.stderr)
        return None

    # Redirecting OpenAI SDK to target OpenRouter's gateway
    client = OpenAI(
        base_url="https://openrouter.ai",
        api_key=openrouter_key
    )
    
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are BharatGpilot, a smart AI assistant."},
                {"role": "user", "content": prompt}
            ],
            model="x-ai/grok-2"
        )
        return response.choices.message.content
    except Exception as e:
        print(f"Grok Error: {str(e)}. Attempting Hugging Face fallback...", file=sys.stderr)
        return None

def query_huggingface(prompt: str, model_id: str = "Qwen/Qwen2.5-Coder-7B-Instruct"):
    """Queries free open-weight models using the Hugging Face Serverless API."""
    hf_token = os.environ.get("HF_TOKEN")
    
    if not hf_token:
        return "Error: Both Grok and Hugging Face keys are missing. Please set your Repository Secrets."

    API_URL = f"https://huggingface.co{model_id}"
    headers = {"Authorization": f"Bearer {hf_token}"}
    
    payload = {
        "inputs": f"<|im_start|>system\nYou are BharatGpilot.<|im_end|>\n<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n",
        "parameters": {"max_new_tokens": 512, "temperature": 0.7}
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        result = response.json()
        
        if isinstance(result, list) and "generated_text" in result:
            return result["generated_text"].split("<|im_start|>assistant\n")[-1].strip()
        return str(result)
    except Exception as e:
        return f"Hugging Face Request Failed: {str(e)}"

def query_bharat_gpilot(prompt: str):
    """Core function that defaults to Grok and falls back to Hugging Face."""
    # Try Grok first
    output = query_grok(prompt)
    
    # If Grok fails or lacks a key, automatically run Hugging Face
    if not output:
        print("--- Running Fallback: Hugging Face Free Tier ---")
        output = query_huggingface(prompt)
        
    return output

if __name__ == "__main__":
    test_prompt = "Write a simple function in Python to clear a console screen."
    print("--- BharatGpilot Output ---")
    print(query_bharat_gpilot(test_prompt))
python 
import os
import sys
from openai import OpenAI

def query_grok(prompt: str):
    """Routes prompts to xAI's Grok models using available system credentials."""
    xai_key = os.environ.get("XAI_API_KEY")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    # Layout 1: Using the official xAI endpoint if you have a premium/trial key
    if xai_key:
        client = OpenAI(
            base_url="https://x.ai",  # Official xAI endpoint layout
            api_key=xai_key
        )
        model_target = "grok-2" # Or the latest available target like grok-beta
        
    # Layout 2: Fallback to OpenRouter's free/low-cost router gateway
    elif openrouter_key:
        client = OpenAI(
            base_url="https://openrouter.ai",
            api_key=openrouter_key
        )
        model_target = "x-ai/grok-2"
        
    else:
        print("Error: Missing XAI_API_KEY or OPENROUTER_API_KEY in repository secrets.", file=sys.stderr)
        sys.exit(1)

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are BharatGpilot, an advanced conversational tool."},
                {"role": "user", "content": prompt}
            ],
            model=model_target
        )
        return response.choices.message.content
    except Exception as e:
        return f"Grok Integration Request Failed: {str(e)}"

if __name__ == "__main__":
    output = query_grok("Write a python script to parse JSON data safely.")
    print("--- Grok Response ---")
    print(output)

