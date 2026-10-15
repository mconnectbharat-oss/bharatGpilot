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
