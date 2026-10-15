
🚀 Production Deployment Guide: BharatGpilot

This guide contains step-by-step instructions to securely deploy and operate the BharatGpilot environment on cloud providers like Amazon Web Services (AWS) or DigitalOcean.

🏗️ Prerequisites

Before initializing the remote deployment pipeline, ensure you have:
• An active cloud account (AWS Console or DigitalOcean Dashboard).
• Remote server access via SSH Keys.
• API access tokens from OpenRouter (OPENROUTER_API_KEY) and/or Hugging Face (HF_TOKEN).

⚡ Setup Option A: DigitalOcean Deployment (Recommended for Simplicity)


1. Create a Linux Droplet Node

1. Log into your DigitalOcean Dashboard.
2. Click Create ➡️ Droplets.
3. Select a standard OS image (e.g., Ubuntu 24.04 LTS).
4. Choose the Basic Plan (A $4 to $6/month node is sufficient for this container runtime).
5. Add your personal public SSH Key for authentication.
6. Click Create Droplet and copy the assigned IP_ADDRESS.

2. Provision and Run Environment

Connect to your remote node and run the initialization script sequence:
bash
# Connect to your cloud server instance
ssh root@<YOUR_DROPLET_IP_ADDRESS>

# Update the baseline package registry arrays
sudo apt update && sudo apt upgrade -y

# Install Git and the Docker Engine runtime layers
sudo apt install -y git docker.io docker-compose-v2

# Clone the repository ecosystem workspace
git clone https://github.com/YOUR_USERNAME/BharatGpilot.git
cd BharatGpilot

# Inject your secure operational API keys into the environment array configuration
echo "OPENROUTER_API_KEY=your_actual_openrouter_token_here" >> .env
echo "HF_TOKEN=your_actual_huggingface_token_here" >> .env

# Build the system image and execute the application container sandbox
sudo docker compose run --rm bharat-gpilot

☁️ Setup Option B: Amazon Web Services (AWS EC2 Cloud Clusters)


1. Provision an EC2 Instance Node

1. Navigate to the AWS Management Console ➡️ EC2 Dashboard.
2. Click Launch Instance and configure the setup parameters:
	• Name: BharatGpilot-Core
	• AMI: Ubuntu Server 24.04 LTS (HVM), SSD Volume Type
	• Instance Type: t3.micro or t3.small (Free Tier Eligible options work perfectly).
	• Key Pair: Select or generate an .pem key pair access file.
3. Under Network Settings, ensure Allow SSH traffic from is checked.
4. Click Launch Instance.

2. Connect and Connect Container Pipelines

Execute these command lines from your local machine terminal window to configure the AWS cloud instance space:
bash
# Configure strict file permissions for your private AWS authentication key
chmod 400 your-key-pair.pem

# Establish a secure connection tunnel to the remote AWS EC2 instance
ssh -i "your-key-pair.pem" ubuntu@<YOUR_AWS_EC2_PUBLIC_DNS>

# Run system initialization dependencies update
sudo apt update && sudo apt install -y git docker.io docker-compose-v2

# Grant running permissions to the default user profile account to execute docker configurations without sudo privileges
sudo usermod -aG docker ubuntu
newgrp docker

# Pull down code configurations from GitHub repository
git clone https://github.com/YOUR_USERNAME/BharatGpilot.git
cd BharatGpilot

# Map your cloud environment configuration parameters safely
cat <<EOF > .env
OPENROUTER_API_KEY=your_openrouter_key
HF_TOKEN=your_huggingface_key
EOF

# Fire up the runtime engine directly on the remote node cluster mapping
docker compose run --rm bharat-gpilot

🔒 Production Security Hardening Checklist

• Zero Hardcoding Rule: Never commit the generated .env configuration file to GitHub. It is actively ignored via the repository .gitignore configuration rule.
• Minimal Privileges: Ensure cloud firewall security groups block all incoming ports except Port 22 (SSH) for remote maintenance work.
• Auto-Cleanup Actions: The Docker Compose execution sequence uses the --rm parameter tag to automatically discard temporary execution session memory containers upon logout.
