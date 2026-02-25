# HTML which will be sent for the confirmation of the profile creation

def constructHTML(firstName, lastName, age, gender, nationality, gradeLevel, bio, profilePicture):
        return f"""
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    
                    <!-- Logo -->
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #ffffff; border-radius: 16px 16px 0 0;">
                            <img src="https://livio-s3-bucket.s3.us-west-1.amazonaws.com/livio_logo/Livio+Logo.png" alt="Livio Logo" style="max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    
                    <!-- Welcome Header with Profile Image -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="width: 80px; vertical-align: middle;">
                                        <img src="{profilePicture}" alt="Profile" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #ffffff; display: block;">
                                    </td>
                                    <td style="padding-left: 20px; vertical-align: middle;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome, {firstName} {lastName}</h1>
                                        <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 16px;">We're thrilled to have you on board.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Welcome Message -->
                    <tr>
                        <td style="padding: 30px;">
                            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Thank you for creating your Livio profile! There are so many people just like you, who can't wait to interact on Livio with you!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Profile Information -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 6px;">
                                <tr>
                                    <td colspan="2" style="background-color: #f8f8f8; padding: 15px; border-bottom: 1px solid #e0e0e0; border-radius: 6px 6px 0 0;">
                                        <h2 style="color: #333333; margin: 0; font-size: 20px;">Your Profile Summary</h2>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; width: 40%; font-weight: bold; color: #555555;">First Name:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{firstName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555555;">Last Name:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{lastName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555555;">Age:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{age}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555555;">Gender:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{gender}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555555;">Nationality:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{nationality}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555555;">Grade Level:</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">{gradeLevel}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; font-weight: bold; color: #555555; vertical-align: top;">Bio:</td>
                                    <td style="padding: 15px; color: #333333;">{bio}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="color: #999999; font-size: 12px; margin: 0;">
                                © 2025 Livio. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        """