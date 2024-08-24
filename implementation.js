function generate_flux_ai_image(params, userSettings) {
  let { prompt, image_size, num_inference_steps, guidance_scale, num_images } = params;
  const { fal_api_key, enable_safety_checker, use_verbatim_prompt } = userSettings;

  if (!fal_api_key) {
    throw new Error("Please set your fal.ai API key in the plugin settings.");
  }

  // Check if the prompt already includes a number of images
  const numImagesRegex = /\b(\d+)\s+images?\b/i;
  if (!numImagesRegex.test(prompt)) {
    // If not, append the user's default number of images to the prompt
    const defaultNumImages = userSettings.num_images || 4;
    prompt += ` Generate ${defaultNumImages} images.`;
    // Also set the num_images parameter
    num_images = defaultNumImages;
  }

  const apiUrl = "https://fal.run/fal-ai/flux/dev";
  const headers = {
    "Authorization": `Key ${fal_api_key}`,
    "Content-Type": "application/json"
  };

  // Helper function for validated parameter extraction
  function getValidatedParameter(param, defaultValue, min, max) {
    const value = param !== undefined ? param : defaultValue;
    return Math.min(Math.max(value, min), max);
  }

  // Remove any surrounding quotation marks from the prompt
  let finalPrompt = prompt.replace(/^["']|["']$/g, '');

  // Determine if we should use verbatim prompt or AI-improve it
  if (use_verbatim_prompt === 'false' || use_verbatim_prompt === false) {
    finalPrompt = `Improve and expand upon this image description, maintaining the core elements: ${finalPrompt}`;
  }

  // Use user settings as defaults if not specified in params
  const actualNumImages = getValidatedParameter(num_images, userSettings.num_images, 1, 4);
  const actualImageSize = image_size || userSettings.image_size || "portrait_4_3";
  const actualInferenceSteps = getValidatedParameter(num_inference_steps, userSettings.num_inference_steps, 1, 50);
  const actualGuidanceScale = getValidatedParameter(guidance_scale, userSettings.guidance_scale, 1, 20);

  // Build the request body
  const body = JSON.stringify({
    prompt: finalPrompt,
    image_size: actualImageSize,
    num_inference_steps: actualInferenceSteps,
    guidance_scale: actualGuidanceScale,
    num_images: actualNumImages,
    enable_safety_checker: enable_safety_checker === 'true' || enable_safety_checker === true
  });

  // Perform the API request
  return fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: body
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
      });
    }
    return response.json();
  })
  .then(result => {
    if (result.images && result.images.length > 0) {
      const imageMarkdown = result.images.map((img, index) =>
        `![Generated Image ${index + 1}](${img.url})`
      ).join("\n\n");

      return `${imageMarkdown}\n\n*Images generated based on the prompt: ${use_verbatim_prompt === 'true' ? prompt : finalPrompt}*\n\n${use_verbatim_prompt === 'true' ? '(Verbatim prompt used)' : '(AI-improved prompt used)'}\nImage size: ${actualImageSize}\nInference steps: ${actualInferenceSteps}\nGuidance scale: ${actualGuidanceScale}\nNumber of images: ${actualNumImages}\nSafety checker: ${enable_safety_checker === 'true' || enable_safety_checker === true ? 'Enabled' : 'Disabled'}\n\nNote: This function has generated exactly ${actualNumImages} image(s) as requested. The AI should not describe or refer to any images beyond this number.`;
    } else {
      throw new Error("No images were generated in the API response.");
    }
  })
  .catch(error => {
    console.error('Error generating image:', error);
    throw new Error('Error: ' + error.message);
  });
}
